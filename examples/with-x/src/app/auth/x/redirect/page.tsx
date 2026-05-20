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
    if (initiated.current) return;
    initiated.current = true;

    const turnkeyAuth = async () => {
      try {
        const storedState = localStorage.getItem("x_oauth_state");
        localStorage.removeItem("x_oauth_state");

        if (!state || !storedState || state !== storedState) {
          throw new Error("OAuth state mismatch");
        }

        const publicKey = await createApiKeyPair();

        const msgBytes = new TextEncoder().encode(publicKey);
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgBytes);
        const nonce = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const res = await fetch("/auth/turnkey/x", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            auth_code,
            state,
            public_key: publicKey,
            nonce,
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
  }, [clientState]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Loading />
    </main>
  );
}
