"use client";

import { useWallet } from "@solana/wallet-adapter-react";

import ButtonSelect from "./ui/button-select";
import { useEffect, useState } from "react";
import Account from "./account";
import WalletSelector from "./wallet-selector";
import { WalletName } from "@solana/wallet-adapter-base";
import { useTurnkey } from "./turnkey-provider";
import { WalletType } from "@turnkey/wallet-stamper";

export function ConnectWallet() {
  const {
    select,
    wallets,
    publicKey,
    disconnect,
    connect: connectSolana,
    signMessage,
  } = useWallet();

  const { setWallet } = useTurnkey();

  const [showWalletSelector, setShowWalletSelector] = useState(false); // State to manage visibility of WalletSelector

  useEffect(() => {
    if (publicKey) {
      if (signMessage) {
        setWallet({
          signMessage: async (message) => {
            const signedMessage = await signMessage(
              Uint8Array.from(Buffer.from(message)),
            );
            return Buffer.from(signedMessage).toString("hex");
          },
          getPublicKey: async () =>
            Buffer.from(publicKey?.toBytes()).toString("hex"),
          type: WalletType.Solana,
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
        onSelect={() => {}}
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
