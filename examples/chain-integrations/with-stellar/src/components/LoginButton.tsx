"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";
import { type ReactElement } from "react";

export default function LoginButton(): ReactElement {
  const { handleLogin } = useTurnkey();

  return (
    <button
      onClick={() => handleLogin()}
      className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 active:scale-95 transition-all cursor-pointer"
    >
      Login with Turnkey
    </button>
  );
}
