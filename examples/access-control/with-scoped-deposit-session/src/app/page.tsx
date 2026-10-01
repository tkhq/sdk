"use client";

import { useTurnkey, ClientState } from "@turnkey/react-wallet-kit";
import { Demo } from "./Demo";

export default function Home() {
  const { clientState } = useTurnkey();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center bg-gray-50 px-4 py-8 text-black">
      {clientState === ClientState.Loading && (
        <div className="text-sm">Initializing…</div>
      )}

      {clientState === ClientState.Error && (
        <button
          onClick={() => window.location.reload()}
          className="rounded bg-gray-200 px-4 py-2"
        >
          Something went wrong. Reload
        </button>
      )}

      {clientState === ClientState.Ready && <Demo />}
    </main>
  );
}
