"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import {
  getSuborgsAction,
  createSuborgAction,
  initOtpAction,
  verifyOtpAction,
  otpLoginAction,
} from "@/server/actions/turnkey";

export default function AuthPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  // The exact session public key tied to this OTP attempt
  const pubKeyRef = useRef<string | null>(null);

  const { storeSession, createApiKeyPair, authState } = useTurnkey();

  // If already authenticated, go to dashboard.
  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      router.replace("/dashboard");
    }
  }, [authState, router]);

  const handleSendCode = async () => {
    try {
      setErr(null);
      const trimmed = email.trim();
      if (!trimmed) throw new Error("Please enter your email.");

      setWorking("Preparing…");

      // 1) Create a fresh session key for this OTP attempt
      const publicKey = await createApiKeyPair();
      pubKeyRef.current = publicKey;

      // reset any prior OTP attempt UI state
      setOtpCode("");
      setOtpId(null);

      setWorking("Sending code…");

      // 2) Kick off OTP with backend, binds this attempt to the current session key
      // Note: publicKey here is used (optionally) for rate limiting SMS OTP requests per user
      const { otpId } = await initOtpAction({ email: trimmed, publicKey });
      setOtpId(otpId);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Failed to send code.");
    } finally {
      setWorking(null);
    }
  };

  const handleOtpLogin = async () => {
    try {
      setErr(null);
      if (!otpId) throw new Error("No OTP in progress.");
      if (!otpCode) throw new Error("Enter the code from your email.");
      if (!pubKeyRef.current)
        throw new Error("Session key missing. Please resend the code.");

      setWorking("Verifying…");

      // 1) Verify the code first (prevents suborg spaming with unverified emails)
      const { verificationToken } = await verifyOtpAction({
        otpId,
        otpCode: otpCode.trim(),
      });

      // 2) Find or create suborg for this email
      let suborgId = (await getSuborgsAction({ filterValue: email.trim() }))
        ?.organizationIds?.[0];
      if (!suborgId) {
        const created = await createSuborgAction({ email: email.trim() });
        suborgId = created.subOrganizationId;
      }

      // 3) Complete login using the same public key generated before initOtp
      const { session } = await otpLoginAction({
        suborgID: suborgId!,
        verificationToken,
        publicKey: pubKeyRef.current!,
      });

      // 4) Store session & go
      await storeSession({ sessionToken: session });
      router.replace("/dashboard");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Login failed.");
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
        <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-7 shadow-sm">
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            Sign in or sign-up
          </h1>
          <p className="mt-1.5 text-sm text-gray-600">
            We’ll email you a one-time code to sign in.
          </p>

          <div className="mt-6 space-y-3">
            <label className="block text-sm">
              Email
              <input
                type="email"
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!working}
              />
            </label>

            {!otpId ? (
              <button
                onClick={handleSendCode}
                disabled={!!working || !email.trim()}
                className="rounded bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {working ? "Sending…" : "Send code"}
              </button>
            ) : (
              <>
                <label className="block text-sm">
                  Enter code
                  <input
                    className="mt-1 w-full rounded border px-3 py-2 text-sm tracking-widest"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    disabled={!!working}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleOtpLogin}
                    disabled={!!working || !otpCode.trim()}
                    className="rounded bg-green-600 px-4 py-2 text-white text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {working ? "Verifying…" : "Verify & continue"}
                  </button>
                  <button
                    onClick={handleSendCode}
                    disabled={!!working}
                    className="rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                    title="Resend code (generates a new session key)"
                  >
                    Resend code
                  </button>
                </div>
              </>
            )}

            {err && (
              <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                {err}
              </div>
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
