"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AuthState, ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { LoginWithXButton } from "@/components/LoginWithXButton";

export default function Home() {
  const router = useRouter();
  const { authState, clientState } = useTurnkey();

  useEffect(() => {
    if (
      clientState === ClientState.Ready &&
      authState === AuthState.Authenticated
    ) {
      router.push("/dashboard");
    }
  }, [authState, clientState, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md w-full">
        <div className="flex justify-center mb-4">
          <Image
            src="/turnkey.png"
            alt="Turnkey Logo"
            width={80}
            height={80}
            className="rounded-full"
          />
        </div>
        <h1 className="text-4xl font-bold text-foreground">Welcome</h1>
        <p className="text-muted-foreground text-lg">Sign in to get started</p>
        <LoginWithXButton />
      </div>
    </main>
  );
}
