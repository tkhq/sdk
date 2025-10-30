"use client";

import { useEffect } from "react";
import { useTurnkey, AuthState, ClientState } from "@turnkey/react-wallet-kit";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const { handleLogin, clientState, authState } = useTurnkey();

  // Once authenticated, go to dashboard
  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      router.replace("/dashboard");
    }
  }, [authState, router]);

  return (
    <main className="grid min-h-[100dvh] place-items-center">
      {clientState === ClientState.Loading && (
        <div className="text-sm text-gray-600">Initializing…</div>
      )}

      {clientState === ClientState.Error && (
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-gray-900 px-4 py-2 text-white"
        >
          Something went wrong. Reload
        </button>
      )}

      {clientState === ClientState.Ready &&
        authState === AuthState.Unauthenticated && (
          <button
            onClick={() => handleLogin()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Login / Sign Up
          </button>
        )}

      {clientState === ClientState.Ready &&
        authState === AuthState.Authenticated && (
          <div className="text-sm text-gray-600">Signing you in…</div>
        )}
    </main>
  );
}
