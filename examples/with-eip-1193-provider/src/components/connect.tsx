"use client";

import React, { useState, useEffect } from "react";
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { TurnkeyClient, type TurnkeyApiTypes } from "@turnkey/http";
import {
  createEIP1193Provider,
  TurnkeyEIP1193Provider,
} from "@turnkey/eip-1193-provider";
import { UUID } from "crypto";
import { Button } from "@/components/ui/button";
import { numberToHex, Address } from "viem";
import { sepolia } from "viem/chains";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { truncate } from "@/lib/utils";

type ConnectProps = {
  organizationId: UUID;
  onAccountConnected: (account: {
    walletId: string;
    account: Address;
    provider: TurnkeyEIP1193Provider;
  }) => void;
};

type Step = "connectWallet" | "connectAccount" | "confirm";

export function Connect({ organizationId, onAccountConnected }: ConnectProps) {
  const [turnkeyClient, setTurnkeyClient] = useState<TurnkeyClient | null>(
    null
  );

  const [wallets, setWallets] = useState<TurnkeyApiTypes["v1Wallet"][]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<UUID | null>(null);
  const [accounts, setAccounts] = useState<Address[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Address | null>(null);
  const [turnkeyProvider, setTurnkeyProvider] =
    useState<TurnkeyEIP1193Provider | null>(null);
  const [step, setStep] = useState<Step>("connectWallet");

  useEffect(() => {
    const initializeClient = async () => {
      const client = new TurnkeyClient(
        { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
        new WebauthnStamper({
          rpId: process.env.NEXT_PUBLIC_WEBAUTHN_RPID!,
        })
      );

      setTurnkeyClient(client);
    };

    initializeClient();
  }, []);

  const fetchWallets = async () => {
    if (turnkeyClient && organizationId) {
      try {
        const { wallets } = await turnkeyClient.getWallets({ organizationId });
        setWallets(wallets);
        setStep("connectAccount");
      } catch (error) {
        console.error("Failed to get wallets:", error);
      }
    }
  };

  const initializeProvider = async (walletId: UUID) => {
    const chain = {
      chainName: sepolia.name,
      chainId: numberToHex(sepolia.id),
      rpcUrls: [process.env.NEXT_PUBLIC_RPC_URL!],
    };

    const provider = await createEIP1193Provider({
      walletId,
      organizationId: organizationId!,
      turnkeyClient: turnkeyClient!,
      chains: [chain],
    });

    return provider;
  };

  const requestAccounts = async () => {
    if (selectedWalletId) {
      const provider = await initializeProvider(selectedWalletId);
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });
      setAccounts(accounts);
      setTurnkeyProvider(provider);
      setStep("confirm");
    }
  };

  const handleAccountSelected = async (account: Address) => {
    setSelectedAccount(account);
  };

  const handleConfirm = async () => {
    if (selectedWalletId && turnkeyProvider && selectedAccount) {
      onAccountConnected({
        walletId: selectedWalletId,
        account: selectedAccount,
        provider: turnkeyProvider,
      });
    }
  };

  const stepConfig: Record<Step, { buttonText: string; onClick: () => void }> =
    {
      connectWallet: {
        buttonText: "Get Wallets",
        onClick: fetchWallets,
      },
      connectAccount: {
        buttonText: "Connect Account",
        onClick: requestAccounts,
      },
      confirm: {
        buttonText: "Confirm",
        onClick: handleConfirm,
      },
    };

  return (
    <section className="w-1/4">
      <div className="text-center mt-20 w-full">
        <div className="space-y-6 mx-auto">
          <Select
            onValueChange={(walletId) => setSelectedWalletId(walletId as UUID)}
            disabled={wallets.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  selectedWalletId ? "Select an account" : "Select a wallet"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((wallet) => (
                <SelectItem key={wallet.walletId} value={wallet.walletId}>
                  {wallet.walletName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedWalletId && (
            <div className="animate-in slide-in-from-left">
              <Select
                onValueChange={handleAccountSelected}
                disabled={accounts.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      selectedAccount ? selectedAccount : "Select an account"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account} value={account}>
                      {truncate(account, { prefixLength: 14, suffixLength: 8 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button onClick={stepConfig[step].onClick} className="w-full mt-12">
          {stepConfig[step].buttonText}
        </Button>
      </div>
    </section>
  );
}
