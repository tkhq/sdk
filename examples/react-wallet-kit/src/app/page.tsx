"use client";

import { useModal, useTurnkey } from "@turnkey/react-wallet-kit";

export default function AuthPage() {
  const { handleLogin, handleExport } = useTurnkey();

  return (
    <div className="w-full h-screen flex items-center justify-center text-black">
      <div className="absolute top-0 right-0">demo</div>
      <button onClick={handleLogin}>
        <span>One</span>
      </button>
    </div>
  );
}
