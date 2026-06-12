"use client";

import { useEffect, useRef, useState } from "react";
import { useTurnkey, ClientState } from "@turnkey/react-wallet-kit";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  getSuborgsAction,
  createSuborgAction,
  authAction,
  exchangeTelegramCodeAction,
} from "@/server/actions/turnkey";

function CallbackInner() {
  const { storeSession, clientState } = useTurnkey();
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  const [status, setStatus] = useState("Completing sign-in…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientState !== ClientState.Ready) return;
    if (handledRef.current) return;
    handledRef.current = true;

    // Clean the URL so TurnkeyProvider doesn't also try to handle the OAuth params
    window.history.replaceState(null, "", "/callback");

    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(`Telegram returned an error: ${errorParam}`);
      return;
    }

    if (!code || !stateParam) {
      setError("No authorization code received.");
      return;
    }

    let pubKey: string;
    let codeVerifier: string;
    try {
      const decoded = JSON.parse(
        new TextDecoder().decode(
          Uint8Array.from(
            atob(stateParam.replace(/-/g, "+").replace(/_/g, "/")),
            (c) => c.charCodeAt(0),
          ),
        ),
      );
      pubKey = decoded.pubKey;
      codeVerifier = decoded.codeVerifier;
      if (!pubKey || !codeVerifier) throw new Error();
    } catch {
      setError("Invalid state parameter — please try again.");
      return;
    }

    (async () => {
      try {
        // 1. Exchange code for ID token (server-side — client_secret stays on server)
        setStatus("Exchanging authorization code…");
        const { idToken } = await exchangeTelegramCodeAction({
          code,
          codeVerifier,
          redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
        });

        // 2. Find or create the Turnkey sub-org bound to this Telegram identity
        setStatus("Looking up your account…");
        let suborgId = (await getSuborgsAction({ filterValue: idToken }))
          ?.organizationIds?.[0];

        if (!suborgId) {
          setStatus("Creating your wallet…");
          const created = await createSuborgAction({
            oauthProviders: [{ providerName: "Telegram", oidcToken: idToken }],
          });
          suborgId = created.subOrganizationId;
        }

        // 3. Exchange OIDC token + public key for a Turnkey session
        setStatus("Signing in…");
        const { session } = await authAction({
          suborgID: suborgId!,
          oidcToken: idToken,
          publicKey: pubKey,
        });

        await storeSession({ sessionToken: session });
        router.replace("/dashboard");
      } catch (e: any) {
        setError(e?.message ?? "Sign-in failed. Please try again.");
      }
    })();
  }, [searchParams, storeSession, clientState]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-red-200 bg-white p-6 shadow-sm max-w-sm w-full">
          <p className="text-sm font-semibold text-red-600">Sign-in failed</p>
          <p className="mt-1 text-sm text-gray-600">{error}</p>
          <button
            onClick={() => router.replace("/")}
            className="mt-4 text-sm text-blue-600 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#2AABEE] mx-auto" />
        <p className="text-sm text-gray-600">{status}</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
