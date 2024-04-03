"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { UUID } from "crypto";
import {
  TurnkeyEIP1193Provider,
  createEIP1193Provider,
} from "@turnkey/eip-1193-provider";
import { signUp } from "@/lib/turnkey";
import { Email } from "@/lib/types";
import { getTurnkeyClient, registerPassKey } from "@/lib/utils";
import { sepolia } from "viem/chains";
import { Address, numberToHex } from "viem";
import { Input } from "@/components/ui/input";

type AuthProps = {
  onAuth: (params: {
    organizationId?: UUID;
    accounts?: Address[];
    provider?: TurnkeyEIP1193Provider;
  }) => void;
};

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL!;
const parentOrgId = process.env.NEXT_PUBLIC_ORGANIZATION_ID!;

export function Auth({ onAuth }: AuthProps) {
  const [email, setEmail] = useState<Email | "">("");

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value as Email);
  };

  const handleLogin = async () => {
    const turnkeyClient = getTurnkeyClient();
    // Call getWhoami and emit the organizationId
    const { organizationId } = (await turnkeyClient.getWhoami({
      organizationId: parentOrgId,
    })) as { organizationId: UUID };
    onAuth({ organizationId });
  };

  const handleSignUp = async () => {
    if (email) {
      const registerPasskeyResult = await registerPassKey(email);

      const { subOrganizationId, walletId, accounts } = await signUp(
        email,
        registerPasskeyResult
      );

      if (walletId && subOrganizationId) {
        const turnkeyClient = getTurnkeyClient();
        const chain = {
          chainName: sepolia.name,
          chainId: numberToHex(sepolia.id),
          rpcUrls: [rpcUrl],
        };

        const provider = await createEIP1193Provider({
          walletId,
          organizationId: subOrganizationId as UUID,
          turnkeyClient,
          chains: [chain],
        });
        onAuth({ provider, accounts, organizationId: subOrganizationId });
      }
    }
  };

  return (
    <div className="space-y-4 w-1/5 mt-12 flex flex-col items-center">
      <Input
        type="email"
        placeholder="satoshi@bitcoin.com"
        value={email}
        onChange={handleEmailChange}
        className="w-full"
      />
      <div className="flex flex-col gap-4 w-full">
        <Button onClick={handleLogin}>Login</Button>
        <Button variant="outline" onClick={handleSignUp}>
          Sign Up
        </Button>
      </div>
    </div>
  );
}
