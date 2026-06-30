"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import {
  createSuborgAction,
  getSuborgsByEmailAction,
} from "@/server/actions/turnkey";

export default function AuthPage() {
  const router = useRouter();
  const {
    createPasskey,
    loginWithPasskey,
    createApiKeyPair,
    deleteApiKeyPair,
    overrideApiKeyStamper,
    storeSession,
    httpClient,
    authState,
  } = useTurnkey();

  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      router.replace("/dashboard");
    }
  }, [authState, router]);

  const handleContinue = async () => {
    try {
      setErr(null);
      const trimmed = email.trim();
      if (!trimmed) throw new Error("Please enter your email.");

      // Guard before any side-effecting calls (createApiKeyPair / createPasskey).
      if (!httpClient) throw new Error("Turnkey client not initialized.");

      setWorking("Looking up account…");

      const existing = await getSuborgsByEmailAction({ email: trimmed });

      if (existing?.organizationIds?.length) {
        // Returning user — also the recovery path if a prior sign-up created the
        // sub-org but stampLogin failed.
        setWorking("Logging in…");
        await loginWithPasskey();
      } else {
        // New user — 1-tap sign-up:
        // Register a temp API key in the sub-org, use overrideApiKeyStamper to stamp
        // stampLogin with it immediately — no second passkey tap required.

        // 1) Temp key stored in IndexedDB — bootstraps the session after sub-org creation
        const tempPublicKey = await createApiKeyPair();

        setWorking("Creating passkey…");

        // 2) One passkey tap — email as the name gives the OS picker a meaningful
        //    label; sanitized to Turnkey's allowed authenticator-name chars.
        const passKeyName = trimmed
          .replace(/[^a-zA-Z0-9 \-_:/]/g, "-")
          .slice(0, 64);
        const { encodedChallenge, attestation } = await createPasskey({
          name: passKeyName,
        });

        setWorking("Creating your account…");

        // 3) Backend creates the sub-org with the passkey as root authenticator
        //    and the temp API key (60s TTL)
        const { subOrganizationId } = await createSuborgAction({
          email: trimmed,
          challenge: encodedChallenge,
          attestation,
          tempPublicKey,
        });

        setWorking("Logging in…");

        // 4) Override the stamper to use the temp key, then call stampLogin to register
        //    the long-lived session keypair — no second passkey tap required.
        const sessionPublicKey = await createApiKeyPair();
        await overrideApiKeyStamper({ temporaryPublicKey: tempPublicKey });
        try {
          const { session } = await httpClient.stampLogin({
            publicKey: sessionPublicKey,
            organizationId: subOrganizationId,
          });
          await storeSession({ sessionToken: session });
        } finally {
          // A throw here would mask an in-flight stampLogin error; fine since the
          // temp key expires server-side in 60s regardless.
          await overrideApiKeyStamper({ temporaryPublicKey: "" });
          await deleteApiKeyPair({ publicKey: tempPublicKey });
        }
      }
    } catch (e) {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setWorking(null);
    }
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
          />
        </a>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 pt-28">
        <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm space-y-6">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
              Passkey authentication
            </h1>
            <p className="mt-1.5 text-sm text-gray-600">
              Sign in or create an account using a passkey stored on your
              device.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-gray-700">
              Email
              <input
                type="email"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !working && handleContinue()}
                disabled={!!working}
                placeholder="you@example.com"
                autoFocus
              />
            </label>
            <button
              onClick={handleContinue}
              disabled={!!working || !email.trim()}
              className="w-full rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {working ?? "Continue with passkey"}
            </button>
          </div>

          {err && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
              {err}
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-xs text-gray-500">
          By continuing you agree to the Terms and acknowledge the Privacy
          Policy.
        </p>
      </div>
    </main>
  );
}
