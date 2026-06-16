"use client";

import { AuthState, ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { useEffect, type ReactElement } from "react";
import LoginButton from "@/components/LoginButton";
import LogoutButton from "@/components/LogoutButton";
import WalletInfo from "@/components/WalletInfo";
import SignMessage from "@/components/SignMessage";
import SendTransaction from "@/components/SendTransaction";

export default function Page(): ReactElement {
  const { authState } = useTurnkey();

  if (authState !== AuthState.Authenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">Turnkey + Stellar</h1>
        <p className="text-gray-500 text-sm">
          Sign in to manage your Stellar wallet
        </p>
        <LoginButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold">Turnkey + Stellar</h1>
        <LogoutButton />
      </div>

      <div className="flex flex-col gap-6">
        <WalletInfo />
        <SignMessage />
        <SendTransaction />
      </div>
    </div>
  );
}
