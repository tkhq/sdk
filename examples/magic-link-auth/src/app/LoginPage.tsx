"use client";

import { useEffect, useRef, useState } from "react";
import { sendMagicLink } from "@/server/actions/sendMagicLink";
import {
  AuthState,
  ClientState,
  useTurnkey,
  getClientSignatureMessageForLogin,
} from "@turnkey/react-wallet-kit";
import { encryptOtpCodeToBundle } from "@turnkey/crypto";
import type { v1ClientSignature } from "@turnkey/sdk-types";
import { verifyOtpAction, completeAuth } from "@/server/actions/completeAuth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const {
    clientState,
    authState,
    createApiKeyPair,
    signWithApiKey,
    storeSession,
  } = useTurnkey();

  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [isProcessingMagicLink, setIsProcessingMagicLink] = useState(() =>
    new URLSearchParams(window.location.search).has("otpCode"),
  );
  // Prevents double-invocation in React Strict Mode (dev) from firing two
  // concurrent verifyOtp calls, which would invalidate the OTP on the second.
  const loginAttempted = useRef(false);

  const validateEmail = (value: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail) return;

    try {
      setIsSubmitting(true);

      // OTP state needs to survive the redirect, so we store it in localStorage
      const { otpId, otpEncryptionTargetBundle } = await sendMagicLink({
        email,
      });

      window.localStorage.setItem("turnkey_otp_id", otpId);
      window.localStorage.setItem(
        "turnkey_otp_encryption_target_bundle",
        otpEncryptionTargetBundle,
      );

      setIsSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setIsValidEmail(validateEmail(email));
  }, [email]);

  // When the user lands here via the magic link the otpCode is in the URL.
  useEffect(() => {
    if (clientState !== ClientState.Ready) return;

    const otpCode = new URLSearchParams(window.location.search).get("otpCode");
    if (otpCode && !loginAttempted.current) {
      loginAttempted.current = true;
      void loginOrSignUp(otpCode);
    }
  }, [clientState]);

  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      router.replace("/dashboard");
    }
  }, [authState, router]);

  const loginOrSignUp = async (code: string) => {
    try {
      const otpId = window.localStorage.getItem("turnkey_otp_id");
      const otpEncryptionTargetBundle = window.localStorage.getItem(
        "turnkey_otp_encryption_target_bundle",
      );

      if (!otpId) throw new Error("No otpId found in local storage.");
      if (!otpEncryptionTargetBundle)
        throw new Error("No encryption bundle found in local storage.");

      // Create the session keypair here, after the redirect
      const publicKey = await createApiKeyPair();

      // Encrypt the OTP code for the enclave's target key — the plaintext
      // code is never sent to our backend.
      const encryptedOtpBundle = await encryptOtpCodeToBundle(
        code.trim(),
        otpEncryptionTargetBundle,
        publicKey,
      );

      // Verify the encrypted bundle → get a verificationToken and the sub-org
      // ID. Sub-org creation is gated here, after Turnkey validates the OTP.
      const { verificationToken, subOrgId } = await verifyOtpAction({
        otpId,
        encryptedOtpBundle,
      });

      // The token's publicKey is the canonical source — it was embedded inside
      // the encrypted bundle by the enclave and equals the key we just created.
      const { message, publicKey: tokenPublicKey } =
        getClientSignatureMessageForLogin({ verificationToken });
      const signature = await signWithApiKey({
        message,
        publicKey: tokenPublicKey,
      });
      const clientSignature: v1ClientSignature = {
        scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
        publicKey: tokenPublicKey,
        message,
        signature,
      };

      const session = await completeAuth({
        verificationToken,
        subOrgId,
        publicKey: tokenPublicKey,
        clientSignature,
      });

      await storeSession({ sessionToken: session });

      window.localStorage.removeItem("turnkey_otp_id");
      window.localStorage.removeItem("turnkey_otp_encryption_target_bundle");
      // On success, authState → Authenticated triggers the redirect and unmounts
      // this component, so isProcessingMagicLink never needs to be reset.
    } catch (err) {
      console.error("Magic link login failed:", err);
      window.localStorage.removeItem("turnkey_otp_id");
      window.localStorage.removeItem("turnkey_otp_encryption_target_bundle");
      loginAttempted.current = false;
      setIsProcessingMagicLink(false);
    }
  };

  if (isProcessingMagicLink) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg shadow-md bg-white w-80 text-center">
          <p className="text-gray-600 text-sm">Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      {!isSent ? (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-6 rounded-lg shadow-md bg-white w-80"
        >
          <h1 className="text-xl font-semibold text-center text-gray-800">
            Log in or Sign up
          </h1>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 text-black rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-500"
            required
          />

          <button
            type="submit"
            disabled={!isValidEmail || isSubmitting}
            className={`rounded px-6 py-2 text-white transition ${
              !isValidEmail || isSubmitting
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-slate-600 hover:bg-slate-700"
            }`}
          >
            {isSubmitting ? "Sending..." : "Continue"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3 p-6 rounded-lg shadow-md bg-white w-80 text-center">
          <h1 className="text-xl font-semibold text-gray-800">
            Check your inbox 📩
          </h1>
          <p className="text-gray-600 text-sm">
            We've sent a magic link to{" "}
            <span className="font-medium">{email}</span>. Click it to finish
            signing in.
          </p>
        </div>
      )}
    </div>
  );
}
