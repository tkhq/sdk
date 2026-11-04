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
