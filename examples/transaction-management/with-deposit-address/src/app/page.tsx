"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";

function LoginButton() {
  const { handleLogin, authState } = useTurnkey();
  const router = useRouter();

  useEffect(() => {
    if (authState === AuthState.Authenticated) router.replace("/dashboard");
  }, [authState, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">Deposit address</h1>
        <p className="mt-2 mb-5 text-sm text-slate-600">
          Get a Base Sepolia address that sweeps ETH and USDC to a destination
          you choose. You stay the only owner of the wallet.
        </p>
        <button
          type="button"
          onClick={() => void handleLogin()}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Log in or sign up
        </button>
      </div>
    </main>
  );
}

export default function Home() {
  return <LoginButton />;
}
