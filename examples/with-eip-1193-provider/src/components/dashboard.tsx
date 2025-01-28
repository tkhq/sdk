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
} from "viem";

import { TurnkeyEIP1193Provider } from "@turnkey/eip-1193-provider";
import Address from "./address";
import {
  Card,
  CardDescription,
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sepolia } from "viem/chains";
import { toast } from "sonner";
import { Icons } from "./ui/icons";
import { estimateFees } from "@/lib/utils";

type DashboardProps = {
  provider: TurnkeyEIP1193Provider;
};

export function Dashboard({ provider }: DashboardProps) {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AddressType | "">("");
  const [sendToAddress, setSendToAddress] = useState<AddressType | "">("");
  const [sendAmount, setSendAmount] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<
    "default" | "getting-accounts"
  >("default");

  useEffect(() => {
    const fetchAccounts = async () => {
      if (provider) {
        const accounts = await provider.request({ method: "eth_accounts" });
        if (accounts.length === 0) {
          setDialogContent("getting-accounts");
          setDialogOpen(true);
          setTimeout(async () => {
            const newAccounts = await provider.request({
              method: "eth_requestAccounts",
            });
            setSelectedAccount(newAccounts[0]);
            setDialogOpen(false);
          }, 1400);
        } else {
          setSelectedAccount(accounts[0]);
        }
      }
    };

    fetchAccounts();
  }, [provider]);

  useEffect(() => {
    const fetchBalance = async () => {
      if (provider && selectedAccount) {
        const balanceInWei = await provider.request({
          method: "eth_getBalance",
          params: [selectedAccount, "latest"],
        });
        const balanceInEther = BigInt(balanceInWei);
        setBalance(balanceInEther);
      }
    };

    fetchBalance();
  }, [provider, selectedAccount]);

  const handleSendTransaction = async () => {
    if (provider && selectedAccount && sendToAddress && sendAmount) {
      const chainId = numberToHex(sepolia.id);
      const nonce = await provider.request({
        method: "eth_getTransactionCount",
        params: [selectedAccount, "latest"],
      });

      const { maxFeePerGas, maxPriorityFeePerGas } = await estimateFees(
        sepolia
      );

      const gas = numberToHex(21000);
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
          duration: 5000,
        });
      } catch (error: any) {
        toast.error("Error sending transaction", {
          description: error.details,
          duration: 10000,
        });
      }
      setDialogOpen(false);
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
            setDialogContent("default");
            setDialogOpen(true);
          }}
          variant="secondary"
          className="w-full mx-auto"
        >
          Send Transaction
        </Button>

        <DialogContent className="sm:max-w-[425px]">
          {dialogContent === "getting-accounts" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-center">
                  Getting Accounts
                </DialogTitle>
                <DialogDescription className="flex justify-center h-20 items-center">
                  <Icons.spinner className="animate-spin w-10" />
                </DialogDescription>
              </DialogHeader>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Send Transaction</DialogTitle>
                <DialogDescription>
                  Enter the transaction details and click send when you're
                  ready.
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
                    onChange={(e) =>
                      setSendToAddress(getAddress(e.target.value))
                    }
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
