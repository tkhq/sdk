"use client";

import { useEffect, useRef, useState } from "react";
import { useTurnkey, AuthState, ClientState } from "@turnkey/react-wallet-kit";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  getSuborgsAction,
  createSuborgAction,
  authAction,
} from "@/server/actions/turnkey";

export default function AuthPage() {
  const { createApiKeyPair, storeSession, authState, clientState } =
    useTurnkey();
  const router = useRouter();

  // We keep the API public key in a ref so it never triggers rerenders
  const pubKeyRef = useRef<string | null>(null);

  // Simple guard to ensure we only create the API keypair once per page load
  const createdOnceRef = useRef(false);

  const [nonce, setNonce] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1) If already authenticated, go to dashboard.
  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      router.push("/dashboard");
    }
  }, [authState, router]);

  // 2) When the Turnkey client is ready, create the API keypair once.
  //    - Save its *public key* in a ref.
  //    - Compute Google nonce = sha256(pubkey) and show the Google button.
  useEffect(() => {
    if (clientState !== ClientState.Ready) return;
    if (createdOnceRef.current) return;

    (async () => {
      try {
        const pubKey = await createApiKeyPair({ storeOverride: true });
        pubKeyRef.current = pubKey;
        setNonce(bytesToHex(sha256(pubKey)));
        createdOnceRef.current = true; // don’t regenerate (avoids nonce mismatch)
      } catch (e: any) {
        setError(e?.message ?? "Failed to initialize API keypair");
      }
    })();
  }, [clientState, createApiKeyPair]);

  // 3) Google success -> exchange OIDC + same pubkey for Turnkey session and store it
  const handleGoogleSuccess = async (resp: any) => {
    const pubKey = pubKeyRef.current; // must be the exact one we hashed for nonce
    if (!pubKey)
      throw new Error("Public key not available (client not ready).");

    // Find or create the sub-org bound to this OIDC token
    let suborgId = (await getSuborgsAction({ filterValue: resp.credential }))
      ?.organizationIds?.[0];

    if (!suborgId) {
      const created = await createSuborgAction({
        oauthProviders: [
          { providerName: "Google", oidcToken: resp.credential },
        ],
      });
      suborgId = created.subOrganizationId;
    }

    // Get the session jwt from the backend as a result of oauth_login
    const { session } = await authAction({
      suborgID: suborgId!,
      oidcToken: resp.credential,
      publicKey: pubKey,
    });

    await storeSession({ sessionToken: session });
    // Hard refresh to ensure context + wallets load cleanly
    window.location.replace("/dashboard");
  };

  return (
    <main className="relative min-h-screen bg-gray-50">
      <header className="absolute top-5 left-5">
        <a href="https://www.turnkey.com" target="_blank" rel="noreferrer">
          <Image
            src="/logo.svg"
            alt="Turnkey"
            width={100}
            height={24}
            priority
            style={{ height: "24px", width: "auto" }}
          />
        </a>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pt-28">
        <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            Sign-in or sign-up to your wallet
          </h1>
          <p className="mt-1.5 text-sm text-gray-600">
            Use Google to create or access your sub-organization.
          </p>

          <div className="mt-6 flex items-center justify-center">
            {authState === AuthState.Authenticated ? (
              <div className="text-sm text-gray-600">Finishing sign-in…</div>
            ) : clientState !== ClientState.Ready ? (
              <div className="text-sm text-gray-600">Preparing login…</div>
            ) : !nonce ? (
              <div className="text-sm text-gray-600">
                {error ?? "Generating nonce…"}
              </div>
            ) : (
              <GoogleOAuthProvider
                clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
              >
                <GoogleLogin
                  nonce={nonce}
                  onSuccess={handleGoogleSuccess}
                  useOneTap={false}
                />
              </GoogleOAuthProvider>
            )}
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-gray-500">
          By continuing you agree to the Terms and acknowledge the Privacy
          Policy.
        </p>
      </div>
    </main>
  );
}
