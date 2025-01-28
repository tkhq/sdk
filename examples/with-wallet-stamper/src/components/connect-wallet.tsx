"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import ButtonSelect from "./ui/button-select";
import { ChainType } from "@/lib/types";
import { useEffect, useState } from "react";
import Account from "./account";
import WalletSelector from "./wallet-selector";
import { WalletName } from "@solana/wallet-adapter-base";
import { useTurnkey } from "./turnkey-provider";

export function ConnectWallet() {
  const { connection } = useConnection();
  const {
    select,
    wallets,
    publicKey,
    disconnect,
    connecting,
    connect: connectSolana,
    wallet,
    connected,
    signMessage,
  } = useWallet();

  const { setWallet } = useTurnkey();

  const [balance, setBalance] = useState<number | null>(null);
  const [userWalletAddress, setUserWalletAddress] = useState<string>("");

  const [selectedChain, setSelectedChain] = useState<ChainType>();
  const [showWalletSelector, setShowWalletSelector] = useState(false); // State to manage visibility of WalletSelector

  useEffect(() => {
    if (!connection || !publicKey) {
      return;
    }

    connection.onAccountChange(
      publicKey,
      (updatedAccountInfo) => {
        setBalance(updatedAccountInfo.lamports / LAMPORTS_PER_SOL);
      },
      "confirmed"
    );

    connection.getAccountInfo(publicKey).then((info) => {
      if (info) {
        setBalance(info.lamports / LAMPORTS_PER_SOL);
      }
    });
  }, [publicKey, connection]);

  useEffect(() => {
    if (publicKey) {
      setUserWalletAddress(publicKey.toBase58()!);

      if (signMessage) {
        setWallet({
          signMessage: async (message) => {
            const signedMessage = await signMessage(Buffer.from(message));
            return Buffer.from(signedMessage).toString("hex");
          },
          recoverPublicKey: () =>
            Buffer.from(publicKey?.toBuffer()).toString("hex"),
          type: "solana",
        });
      }
    }
  }, [publicKey, signMessage]);

  const connect = async () => {
    setShowWalletSelector(true);
  };
  const handleWalletSelect = async (walletName: WalletName) => {
    if (walletName) {
      try {
        select(walletName);
        await connectSolana();
        setShowWalletSelector(false);
      } catch (error) {
        console.error("wallet connection err : ", error);
      }
    }
  };

  if (publicKey) {
    return (
      <Account
        address={publicKey.toString()}
        balance={balance?.toString() || ""}
        disconnect={async () => {
          await disconnect();
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ButtonSelect
        connect={connect}
        onSelect={(selection: ChainType) => setSelectedChain(selection)}
      >
        Connect
      </ButtonSelect>
      <WalletSelector
        setOpen={setShowWalletSelector}
        open={showWalletSelector}
        wallets={wallets}
        onWalletSelect={handleWalletSelect}
      />
    </div>
  );
}
