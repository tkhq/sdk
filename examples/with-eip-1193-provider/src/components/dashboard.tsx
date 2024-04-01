"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  parseEther,
  Address as AddressType,
  formatEther,
  getAddress,
  Hex,
  numberToHex,
  parseGwei,
} from "viem";

import { TurnkeyEIP1193Provider } from "@turnkey/eip-1193-provider";
import Address from "./address";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sepolia } from "viem/chains";
import { toast } from "sonner";
// import { ToastAction } from '@/components/ui/toast';

type DashboardProps = {
  provider: TurnkeyEIP1193Provider;
};

export function Dashboard({ provider }: DashboardProps) {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AddressType | "">("");
  const [sendToAddress, setSendToAddress] = useState<AddressType | "">("");
  const [sendAmount, setSendAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchAccountAndBalance = async () => {
      if (provider) {
        const accounts = await provider.request({ method: "eth_accounts" });
        setSelectedAccount(accounts[0]);

        const balanceInWei = await provider.request({
          method: "eth_getBalance",
          params: [accounts[0], "latest"],
        });
        const balanceInEther = BigInt(balanceInWei);
        setBalance(balanceInEther);
      }
    };

    fetchAccountAndBalance();
  }, [provider]);

  const handleSendTransaction = async () => {
    if (provider && selectedAccount && sendToAddress && sendAmount) {
      const chainId = numberToHex(sepolia.id);
      const nonce = await provider.request({
        method: "eth_getTransactionCount",
        params: [selectedAccount, "latest"],
      });
      const gas = numberToHex(21000);
      const maxFeePerGas = numberToHex(parseGwei("20"));
      const maxPriorityFeePerGas = numberToHex(parseGwei("2"));
      const transactionType = "0x2";
      const amountInWei = parseEther(sendAmount);
      const transaction = {
        from: selectedAccount,
        to: sendToAddress,
        value: `0x${amountInWei.toString(16)}` as Hex,
        maxFeePerGas,
        maxPriorityFeePerGas,
        transactionType,
        gas,
        nonce,
        chainId,
      };

      try {
        const txHash = await provider.request({
          method: "eth_sendTransaction",
          params: [transaction],
        });
        setDialogOpen(false);
        toast("Transaction sent! 🎉", {
          description: "View your transaction on Etherscan.",
          action: {
            label: "View",
            onClick: () => {
              window.open(
                `https://sepolia.etherscan.io/tx/${txHash}`,
                "_blank"
              );
            },
          },
        });
      } catch (error: any) {
        toast("Error sending transaction", {
          description: error.message,
        });
      }
    }
  };

  return (
    <div className="flex flex-col items-center text-center mt-20 w-1/4 space-y-6">
      <Card className="w-full flex flex-col items-center">
        <CardHeader className="items-center">
          <CardTitle>
            <Address address={selectedAccount ?? ""} />
          </CardTitle>
          <CardDescription>
            {balance !== null && `Balance: ${formatEther(balance)} ETH`}
          </CardDescription>
        </CardHeader>
      </Card>

      <Dialog open={dialogOpen}>
        <Button
          onClick={() => {
            setDialogOpen(true);
          }}
          variant="secondary"
          className="w-full mx-auto"
        >
          Send Transaction
        </Button>

        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Transaction</DialogTitle>
            <DialogDescription>
              Enter the transaction details and click send when you're ready.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sendFrom" className="text-right">
                Send From
              </Label>
              <Input
                id="sendFrom"
                value={selectedAccount}
                disabled
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="sendTo" className="text-right">
                Send To
              </Label>
              <Input
                id="sendTo"
                value={sendToAddress}
                onChange={(e) => setSendToAddress(getAddress(e.target.value))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Amount (ETH)
              </Label>
              <Input
                type="number"
                id="amount"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSendTransaction}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
