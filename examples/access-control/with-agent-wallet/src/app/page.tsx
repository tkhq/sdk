"use client";
import { useTurnkey } from "@turnkey/react-wallet-kit";

function LoginButton() {
  const { handleLogin } = useTurnkey();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold text-gray-900">Agent Wallet Demo</h1>
      <p className="text-sm text-gray-500 max-w-sm text-center">
        Sign in to create your embedded wallet and configure an AI agent with
        policy-gated signing access.
      </p>
      <button
        type="button"
        onClick={() => void handleLogin()}
        className="rounded bg-slate-700 px-6 py-2.5 text-sm text-white hover:bg-slate-800"
      >
        Login / Sign Up
      </button>
    </div>
  );
}

export default function Home() {
  return <LoginButton />;
}
