"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { Loading } from "@/components/Loading";

export default function RedirectPage() {
  const { createApiKeyPair, storeSession, clientState } = useTurnkey();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initiated = useRef(false);

  const auth_code = searchParams.get("code");
  const state = searchParams.get("state");

  useEffect(() => {
    if (clientState !== ClientState.Ready) return;
    if (!auth_code || !state) return;
    if (initiated.current) return;
    initiated.current = true;

    const turnkeyAuth = async () => {
      try {
        const publicKey = await createApiKeyPair();

        const res = await fetch("/auth/turnkey/x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth_code,
            state,
            public_key: publicKey,
          }),
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
  }, [clientState, auth_code, state, router, createApiKeyPair, storeSession]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Loading />
    </main>
  );
}
