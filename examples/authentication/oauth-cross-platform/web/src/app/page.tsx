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
import { Header } from "@/components/Header";

const IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const ANDROID_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

function parseJwtPayload(token: string): Record<string, unknown> {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

export default function AuthPage() {
  const { createApiKeyPair, storeSession, authState, clientState } =
    useTurnkey();
  const router = useRouter();

  const pubKeyRef = useRef<string | null>(null);
  const createdOnceRef = useRef(false);
  const [nonce, setNonce] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const secondaryClientIds = [IOS_CLIENT_ID, ANDROID_CLIENT_ID].filter(Boolean);

  useEffect(() => {
    if (authState === AuthState.Authenticated) router.push("/dashboard");
  }, [authState, router]);

  useEffect(() => {
    if (clientState !== ClientState.Ready || createdOnceRef.current) return;
    (async () => {
      try {
        const pubKey = await createApiKeyPair();
        pubKeyRef.current = pubKey;
        setNonce(bytesToHex(sha256(pubKey)));
        createdOnceRef.current = true;
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : "Failed to initialize keypair",
        );
      }
    })();
  }, [clientState, createApiKeyPair]);

  const handleGoogleSuccess = async (resp: { credential?: string }) => {
    const pubKey = pubKeyRef.current;
    const oidcToken = resp.credential;
    if (!pubKey || !oidcToken) throw new Error("Not ready");

    // Store iss + sub so the dashboard can use them for platform verification
    const claims = parseJwtPayload(oidcToken);
    if (claims.iss && claims.sub) {
      sessionStorage.setItem(
        "tk_oauth_claims",
        JSON.stringify({ iss: claims.iss, sub: claims.sub }),
      );
    }

    // Find existing sub-org or create a new one with secondary platform claims
    const existing = await getSuborgsAction({ oidcToken });
    let suborgId = existing?.organizationIds?.[0];

    if (!suborgId) {
      const created = await createSuborgAction({
        oidcToken,
        secondaryClientIds,
      });
      suborgId = created.subOrganizationId;
      sessionStorage.setItem("tk_is_new_account", "true");
    } else {
      sessionStorage.setItem("tk_is_new_account", "false");
    }

    const { session } = await authAction({
      suborgId: suborgId!,
      oidcToken,
      publicKey: pubKey,
    });
    await storeSession({ sessionToken: session });
    window.location.replace("/dashboard");
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <Header />
        <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm space-y-4">
          <h1 className="text-lg font-semibold text-gray-900">
            Sign in to your wallet
          </h1>
          <p className="text-sm text-gray-600">
            Sign up with Google. Your identity will be registered for all
            configured platforms so you can log in from any of them.
          </p>

          {secondaryClientIds.length > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <span className="font-semibold">Cross-platform enabled</span>
              {" — also registering for "}
              {[IOS_CLIENT_ID && "iOS", ANDROID_CLIENT_ID && "Android"]
                .filter(Boolean)
                .join(" and ")}
              .
            </div>
          )}

          <div className="pt-2 flex justify-center">
            {authState === AuthState.Authenticated ? (
              <p className="text-sm text-gray-500">Finishing sign-in…</p>
            ) : clientState !== ClientState.Ready ? (
              <p className="text-sm text-gray-500">Preparing…</p>
            ) : !nonce ? (
              <p className="text-sm text-gray-500">
                {error ?? "Generating nonce…"}
              </p>
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

        <div className="flex justify-center mt-2">
          <a href="https://www.turnkey.com" target="_blank" rel="noreferrer">
            <Image
              src="/secured-by-turnkey.svg"
              alt="Secured by Turnkey"
              width={130}
              height={24}
            />
          </a>
        </div>
      </div>
    </main>
  );
}
