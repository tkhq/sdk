"use client";

import { useTurnkey } from "@turnkey/react-wallet-kit";

export default function AuthPage() {
  const { login, handleExport } = useTurnkey();

  return (
    <div className="w-full h-screen flex items-center justify-center bg-yellow-400">
      <div className="absolute top-0 right-0">demo</div>
      <button onClick={login}>
        <span className="text-white">One</span>
      </button>
      <button onClick={() => handleExport({ walletId: "4342" })}>
        <span className="text-white">Two</span>
      </button>
    </div>
  );
}
