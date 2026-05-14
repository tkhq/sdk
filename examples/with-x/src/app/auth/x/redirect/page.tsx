"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { Loading } from "@/components/Loading";

export default function RedirectPage() {
  const { createApiKeyPair, storeSession } = useTurnkey();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initiated = useRef(false);

  const auth_code = searchParams.get("code");
  const state = searchParams.get("state");

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    const turnkeyAuth = async () => {
      try {
        const publicKey = await createApiKeyPair();

        const res = await fetch("/auth/turnkey/x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth_code, state, public_key: publicKey }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Auth failed");
        }

        await storeSession({ sessionToken: data.session });
        router.push("/dashboard");
      } catch (e) {
        console.error(`Failed logging in: ${e}`);
        router.push("/");
      }
    };

    turnkeyAuth();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <Loading />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Logging In</h1>
        <p className="text-muted-foreground">
          Please wait while we sign you in...
        </p>
      </div>
    </main>
  );
}
