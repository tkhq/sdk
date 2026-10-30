"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ClientState, useTurnkey } from "@turnkey/react-wallet-kit";
import { Loading } from "@/components/Loading";

function Redirect() {
  const { createApiKeyPair, storeSession, clientState } = useTurnkey();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initiated = useRef(false);
  const [error, setError] = useState<string | null>(null);

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

        // Never assume the body is JSON: a proxy or an unhandled server error can
        // return HTML or text, and blindly parsing it hides the real status.
        const raw = await res.text();
        let data: { error?: string; session?: string } = {};
        try {
          data = JSON.parse(raw);
        } catch {
          data = {
            error: raw.trim() || `Request failed with HTTP ${res.status}`,
          };
        }

        if (!res.ok) {
          throw new Error(
            data.error ?? `Request failed with HTTP ${res.status}`,
          );
        }

        await storeSession({ sessionToken: data.session! });
        router.push("/dashboard");
      } catch (e) {
        // Show the reason rather than bouncing to "/" with it only in the console.
        // The claim gate rejecting a wrong X account is the expected path here.
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    turnkeyAuth();
  }, [clientState, auth_code, state, router, createApiKeyPair, storeSession]);

  if (error) {
    const allocation =
      typeof window === "undefined"
        ? null
        : localStorage.getItem("claim_allocation");
    return (
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <h1 className="text-lg font-semibold">Claim rejected</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => router.push(allocation ? `/claim/${allocation}` : "/")}
          className="text-sm underline text-muted-foreground hover:text-foreground"
        >
          {allocation ? "Back to the claim page" : "Back to start"}
        </button>
      </div>
    );
  }

  return <Loading />;
}

export default function RedirectPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={<Loading />}>
        <Redirect />
      </Suspense>
    </main>
  );
}
