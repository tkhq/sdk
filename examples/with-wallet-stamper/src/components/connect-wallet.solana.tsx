"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "./ui/button";
import {
  useWalletModal,
  WalletConnectButton,
} from "@solana/wallet-adapter-react-ui";

export function ConnectWallet() {
  const { connected, connect, select } = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <Button
      onClick={() => {
        console.log("click");
        setVisible(true);
      }}
    >
      {connected ? "Connected" : "Connect"}
    </Button>
  );
}
