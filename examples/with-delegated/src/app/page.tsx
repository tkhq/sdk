"use client";
import { useTurnkey } from "@turnkey/react-wallet-kit";

function LoginButton() {
  const { handleLogin } = useTurnkey();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="mb-4 text-lg font-medium text-gray-800">
        Please log in or sign up to continue.
      </p>
      <button
        type="button"
        onClick={() => void handleLogin()}
        className="rounded bg-slate-600 px-6 py-2 text-white hover:bg-slate-700"
      >
        Login / Sign Up
      </button>
    </div>
  );
}

export default function Home() {
  return <LoginButton />;
}
