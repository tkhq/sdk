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
  const urlCleanedRef = useRef(false);
  const codeRef = useRef<string | null>(null);
  const stateRef = useRef<string | null>(null);
  const errorRef = useRef<string | null>(null);

  const [status, setStatus] = useState("Completing sign-in…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Capture params before cleaning the URL — useSearchParams may return null
    // after history.replaceState removes the query string.
    if (!codeRef.current) codeRef.current = searchParams.get("code");
    if (!stateRef.current) stateRef.current = searchParams.get("state");
    if (!errorRef.current) errorRef.current = searchParams.get("error");

    // Clean the URL once so TurnkeyProvider never sees the OAuth params.
    // Only do this once — subsequent runs must not overwrite a navigation
    // already initiated by router.replace("/dashboard").
    if (!urlCleanedRef.current) {
      urlCleanedRef.current = true;
      window.history.replaceState(null, "", "/callback");
    }

    if (clientState !== ClientState.Ready) return;
    if (handledRef.current) return;
    handledRef.current = true;

    const code = codeRef.current;
    const stateParam = stateRef.current;
    const errorParam = errorRef.current;

    if (errorParam) {
      setError(`Telegram returned an error: ${errorParam}`);
      return;
    }

    if (!code || !stateParam) {
      setError("No authorization code received.");
      return;
    }

    const stored = sessionStorage.getItem(`pkce:${stateParam}`);
    sessionStorage.removeItem(`pkce:${stateParam}`);
    if (!stored) {
      setError("Invalid or expired state — please try again.");
      return;
    }
    let pubKey: string;
    let codeVerifier: string;
    try {
      const parsed = JSON.parse(stored);
      pubKey = parsed.pubKey;
      codeVerifier = parsed.codeVerifier;
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
  }, [searchParams, storeSession, clientState]); // searchParams kept to capture params on first render

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
