"use client";

import Image from "next/image";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { LogoutButton } from "./LogoutButton";

export function Header() {
  const { authState } = useTurnkey();

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Image src="/logo.svg" alt="Turnkey" width={96} height={22} priority />
        <span className="text-sm text-gray-400">OAuth Cross-Platform Demo</span>
      </div>
      {authState === AuthState.Authenticated && <LogoutButton />}
    </header>
  );
}
