"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTurnkey } from "@turnkey/sdk-react";

export default function Home() {
  const router = useRouter();
  const { indexedDbClient } = useTurnkey();

  const handleXLogin = () => {
    router.push("/auth/x");
  };

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
        <Button onClick={handleXLogin}>
          Login with
          <Image src="/x.svg" width={20} height={20} alt="Logo" />
        </Button>
      </div>
    </main>
  );
}
