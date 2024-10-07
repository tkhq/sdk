"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTurnkey } from "@/components/turnkey-provider";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Wallet } from "@/lib/types";
import Wallets from "./wallets";
import { Input } from "./ui/input";

import { useTurnkey as useReactTurnkey } from "@turnkey/sdk-react";

const User: React.FC = () => {
  const { turnkey, authIframeClient } = useReactTurnkey();
  const { user, createWallet, getWallets } = useTurnkey();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletName, setWalletName] = useState<string>("");

  // Ideally use something like SWR to handle this properly.
  // Load wallets on mount
  useEffect(() => {
    getWallets().then((wallets) => setWallets(wallets));
  }, []);

  const handleCreateWallet = (walletName: string) => {
    createWallet(walletName, () => {
      getWallets().then((wallets) => setWallets(wallets));
    });
    setWalletName("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription className="space-x-2">
          <Label className="text-sm text-primary">Organization ID</Label>
          <span>{user?.organizationId}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex w-full max-w-sm items-center space-x-2">
          <Button
            variant="secondary"
            onClick={() => handleCreateWallet(walletName)}
          >
            Create Wallet
          </Button>
          <Input
            value={walletName}
            onChange={(e) => setWalletName(e.target.value)}
            type="text"
            placeholder="Wallet Name"
          />
        </div>

        {wallets.length > 0 && <Wallets wallets={wallets} />}
      </CardContent>
    </Card>
  );
};

export default User;
