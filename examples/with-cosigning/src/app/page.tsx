"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useTurnkey,
  AuthState,
  getClientSignatureMessageForLogin,
} from "@turnkey/react-wallet-kit";
import { encryptOtpCodeToBundle } from "@turnkey/crypto";
import type { v1ClientSignature } from "@turnkey/sdk-types";
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
  const [otpEncryptionTargetBundle, setOtpEncryptionTargetBundle] = useState<
    string | null
  >(null);
  const [otpCode, setOtpCode] = useState("");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const { storeSession, createApiKeyPair, signWithApiKey, authState } =
    useTurnkey();

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
      const pk = await createApiKeyPair();
      setPublicKey(pk);
      setOtpCode("");
      setOtpId(null);

      setWorking("Sending code…");
      const { otpId, otpEncryptionTargetBundle } = await initOtpAction({
        email: trimmed,
        publicKey: pk,
      });
      setOtpEncryptionTargetBundle(otpEncryptionTargetBundle);
      setOtpId(otpId);
    } catch (e: unknown) {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Failed to send code.");
    } finally {
      setWorking(null);
    }
  };

  const handleVerify = async () => {
    try {
      setErr(null);
      if (!otpId) throw new Error("No OTP in progress.");
      if (!otpCode.trim()) throw new Error("Enter the code from your email.");
      if (!publicKey || !otpEncryptionTargetBundle)
        throw new Error("Session key missing. Please resend the code.");

      setWorking("Verifying…");

      const encryptedOtpBundle = await encryptOtpCodeToBundle(
        otpCode.trim(),
        otpEncryptionTargetBundle,
        publicKey,
      );

      const { verificationToken } = await verifyOtpAction({
        otpId,
        encryptedOtpBundle,
      });

      setWorking("Finding or creating your wallet…");

      let suborgId = (await getSuborgsAction({ filterValue: email.trim() }))
        ?.organizationIds?.[0];

      if (!suborgId) {
        const created = await createSuborgAction({ email: email.trim() });
        suborgId = created.subOrganizationId;
      }

      const { message } = getClientSignatureMessageForLogin({
        verificationToken,
      });

      const signature = await signWithApiKey({ message, publicKey });

      const clientSignature: v1ClientSignature = {
        scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
        publicKey,
        message,
        signature,
      };

      const { session } = await otpLoginAction({
        suborgID: suborgId!,
        verificationToken,
        publicKey,
        clientSignature,
      });

      await storeSession({ sessionToken: session });
      router.replace("/dashboard");
    } catch (e: unknown) {
      console.error(e);
      setErr(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setWorking(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Co-Signing Demo</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign in with your email to get started.
          </p>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Email
            <input
              type="email"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !otpId && handleSendCode()}
              disabled={!!working}
              placeholder="you@example.com"
            />
          </label>

          {!otpId ? (
            <button
              onClick={handleSendCode}
              disabled={!!working || !email.trim()}
              className="w-full rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {working ?? "Send code"}
            </button>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700">
                One-time code
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                  placeholder="123456"
                  disabled={!!working}
                  autoFocus
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleVerify}
                  disabled={!!working || !otpCode.trim()}
                  className="flex-1 rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {working ?? "Verify & sign in"}
                </button>
                <button
                  onClick={handleSendCode}
                  disabled={!!working}
                  className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Resend
                </button>
              </div>
            </>
          )}

          {err && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
              {err}
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-xs text-gray-400">
          First sign-in creates a sub-org with a 2-of-2 root quorum — your key
          and the backend cosigner key.
        </p>
      </div>
    </main>
  );
}
