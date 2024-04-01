"use client";

import React, { useState } from "react";
import { Connect } from "@/components/connect";
import { Dashboard } from "@/components/dashboard";
import { TurnkeyEIP1193Provider } from "@turnkey/eip-1193-provider";
import { Address } from "viem";
import Image from "next/image";
import { UUID } from "crypto";
import { Auth } from "@/components/auth";

type ConnectedAccount = {
  walletId: string;
  account: Address;
  provider: TurnkeyEIP1193Provider;
};

export default function Home() {
  const [connectedAccount, setConnectedAccount] =
    useState<ConnectedAccount | null>(null);
  const [organizationId, setOrganizationId] = useState<UUID | null>(null);

  const handleAccountConnected = (account: ConnectedAccount) => {
    setConnectedAccount(account);
  };

  const handleAuth = (params: {
    organizationId?: UUID;
    provider?: TurnkeyEIP1193Provider;
  }) => {
    if (params.provider) {
      // If provider is emitted (SignUp action), go straight to the dashboard
      setConnectedAccount({
        walletId: "",
        account: "" as Address,
        provider: params.provider,
      });
    } else if (params.organizationId) {
      // If organizationId is emitted (Login action), render the Connect component
      setOrganizationId(params.organizationId);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-full sm:before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-radial before:from-white before:to-transparent before:blur-2xl before:content-[''] after:absolute after:-z-20 after:h-[180px] after:w-full sm:after:w-[240px] after:translate-x-1/3 after:bg-gradient-conic after:from-sky-200 after:via-blue-200 after:blur-2xl after:content-[''] before:dark:bg-gradient-to-br before:dark:from-transparent before:dark:to-darkest-blue before:dark:opacity-10 after:dark:from-bright-pink after:dark:via-dark-blue after:dark:opacity-40 before:lg:h-[360px] z-[-1]">
        <a
          className="pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0"
          href="http://docs.turnkey.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            className="mx-auto fill-white"
            src="/turnkey-logo.svg"
            width={200}
            height={200}
            alt="Turnkey Logo"
            priority
          />
        </a>
      </div>
      {!connectedAccount ? (
        organizationId ? (
          <Connect
            onAccountConnected={handleAccountConnected}
            organizationId={organizationId}
          />
        ) : (
          <Auth onAuth={handleAuth} />
        )
      ) : (
        <Dashboard provider={connectedAccount.provider} />
      )}
    </main>
  );
}
