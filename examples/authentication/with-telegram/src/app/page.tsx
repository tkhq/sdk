"use client";

import { useEffect, useRef, useState } from "react";
import { useTurnkey, AuthState, ClientState } from "@turnkey/react-wallet-kit";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import Image from "next/image";
import { useRouter } from "next/navigation";

const TELEGRAM_AUTH_URL = "https://oauth.telegram.org/auth";

function base64URLEncode(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return base64URLEncode(buf);
}

function generateCodeChallenge(verifier: string): string {
  const hash = sha256(new TextEncoder().encode(verifier));
  return base64URLEncode(hash);
}

export default function AuthPage() {
  const { createApiKeyPair, authState, clientState } = useTurnkey();
  const router = useRouter();

  const pubKeyRef = useRef<string | null>(null);
  const createdOnceRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authState === AuthState.Authenticated) router.push("/dashboard");
  }, [authState, router]);

  useEffect(() => {
    if (clientState !== ClientState.Ready) return;
    if (createdOnceRef.current) return;

    (async () => {
      try {
        const pubKey = await createApiKeyPair();
        pubKeyRef.current = pubKey;
        createdOnceRef.current = true;
        setReady(true);
      } catch (e: any) {
        setError(e?.message ?? "Failed to initialize");
      }
    })();
  }, [clientState, createApiKeyPair]);

  const handleTelegramLogin = () => {
    const pubKey = pubKeyRef.current;
    if (!pubKey) return;

    const nonce = bytesToHex(sha256(pubKey));
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Use a random opaque state token; store pubKey + codeVerifier in
    // sessionStorage keyed by it. This keeps code_verifier out of the URL
    // (browser history, referrer headers) while still surviving the redirect,
    // since login and callback share the same origin.
    const state = crypto.randomUUID();
    sessionStorage.setItem(
      `pkce:${state}`,
      JSON.stringify({ pubKey, codeVerifier }),
    );

    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.NEXT_PUBLIC_TELEGRAM_BOT_ID!,
      redirect_uri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
      scope: "openid",
      nonce,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    window.location.href = `${TELEGRAM_AUTH_URL}?${params}`;
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
            style={{ width: "auto", height: "24px" }}
          />
        </a>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pt-28">
        <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            Sign in or sign up to your wallet
          </h1>
          <p className="mt-1.5 text-sm text-gray-600">
            Use Telegram to create or access your sub-organization.
          </p>

          <div className="mt-6 flex items-center justify-center">
            {authState === AuthState.Authenticated ? (
              <p className="text-sm text-gray-600">Finishing sign-in…</p>
            ) : !ready ? (
              <p className="text-sm text-gray-600">
                {error ?? "Preparing login…"}
              </p>
            ) : (
              <button
                onClick={handleTelegramLogin}
                className="flex items-center gap-2 rounded-lg bg-[#2AABEE] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#229ED9] transition-colors"
              >
                <TelegramIcon />
                Log in with Telegram
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.48 14.31l-2.95-.924c-.64-.203-.654-.64.136-.95l11.5-4.433c.535-.194 1.002.13.396.245z" />
    </svg>
  );
}
