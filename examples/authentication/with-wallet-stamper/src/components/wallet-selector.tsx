"use client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet } from "@solana/wallet-adapter-react";
import { WalletName } from "@solana/wallet-adapter-base";
import Image from "next/image";
import { useEffect } from "react";

interface WalletSelectorProps {
  wallets: Wallet[];
  onWalletSelect: (walletName: WalletName) => void;
  setOpen: (open: boolean) => void;
  open: boolean;
}

export default function WalletSelector({
  wallets,
  onWalletSelect,
  open,
  setOpen,
}: WalletSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="">
        <DialogHeader>
          <DialogTitle>Select a Wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet to connect with:
          </DialogDescription>
        </DialogHeader>
        <div className="flex w-full justify-center items-center">
          <div className="flex flex-col justify-start items-center space-y-5 w-[300px] md:w-[400px] overflow-y-auto">
            {wallets.map((wallet) => (
              <Button
                key={wallet.adapter.name}
                onClick={() => {
                  onWalletSelect(wallet.adapter.name);
                }}
                variant="ghost"
                className="h-[40px] hover:bg-transparent hover:text-white text-[20px] text-white font-slackey flex w-full justify-center items-center"
              >
                <div className="flex">
                  <Image
                    src={wallet.adapter.icon}
                    alt={wallet.adapter.name}
                    height={30}
                    width={30}
                    className="mr-5"
                  />
                </div>
                <div className="font-slackey text-white wallet-name text-[20px]">
                  {wallet.adapter.name}
                </div>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
