"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";

export default function Dashboard() {
  const { authState, logout } = useTurnkey();

  const router = useRouter();

  useEffect(() => {
    if (authState === AuthState.Unauthenticated) {
      router.replace("/");
    }
  }, [authState, router]);

  if (authState !== AuthState.Authenticated) {
    return <p className="text-center text-gray-600 mt-10">Loading...</p>;
  }

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 bg-gray-50">
      <button
        type="button"
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded bg-red-600 px-3 py-1.5 sm:px-4 sm:py-2 text-white text-xs sm:text-sm hover:bg-red-700"
      >
        Log out
      </button>

      <div className="flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
          🎉 You’re now authenticated!
        </h1>
        <p className="text-gray-600">
          You have successfully logged in using a Magic Link.
        </p>
      </div>
    </main>
  );
}
