"use client";

import { useEffect, useState } from "react";
import { sendMagicLink } from "@/server/actions/sendMagicLink";
import { AuthState, ClientState, getClientSignatureMessageForLogin, useTurnkey } from "@turnkey/react-wallet-kit";
import { completeAuth, verifyOtpAction } from "@/server/actions/completeAuth";
import { useRouter } from "next/navigation";
import { v1ClientSignature } from "@turnkey/sdk-server";
import { encryptOtpCodeToBundle } from "@turnkey/crypto";

function LoginPage() {
  const router = useRouter();
  const { clientState, authState, createApiKeyPair, storeSession, signWithApiKey } =
    useTurnkey();

  const [email, setEmail] = useState("");
  const [isValidEmail, setIsValidEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  // small helper to validate the email format
  const validateEmail = (value: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValidEmail) return;

    try {
      setIsSubmitting(true);
      const { otpId, otpEncryptionTargetBundle } = await sendMagicLink({ email });

      // we store the otpId and otpEncryptionTargetBundle in local storage to use it later when the user clicks the magic link
      // since its needed to verify the otp code
      window.localStorage.setItem("turnkey_otp_id", otpId);
      window.localStorage.setItem("turnkey_otp_encryption_target_bundle", otpEncryptionTargetBundle);

      setIsSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setIsValidEmail(validateEmail(email));
  }, [email]);

  // this useEffect checks if the user was brought here by the magic link. I.e has
  // the otpCode in the URL params and then continues with the login/signup flow
  useEffect(() => {
    if (clientState !== ClientState.Ready) return;

    const params = new URLSearchParams(window.location.search);
    const otpCode = params.get("otpCode");

    if (otpCode) {
      loginOrSignUp(otpCode);
    }
  }, [clientState]);

  useEffect(() => {
    if (authState === AuthState.Authenticated) {
      router.replace("/dashboard");
    }
  }, [authState, router]);

  const loginOrSignUp = async (otpCode: string) => {
    // get the otpId from local storage
    const otpId = window.localStorage.getItem("turnkey_otp_id");

    if (!otpId) {
      throw new Error("No otpId found in local storage.");
    }

    const otpEncryptionTargetBundle = window.localStorage.getItem("turnkey_otp_encryption_target_bundle");

    if (!otpEncryptionTargetBundle) {
      throw new Error("No otpEncryptionTargetBundle found in local storage.");
    }

    const publicKey = await createApiKeyPair();
    const encryptedOtpBundle = await encryptOtpCodeToBundle(
        otpCode.trim(),
        otpEncryptionTargetBundle,
        publicKey,
      );

      // Verify the encrypted bundle → get a verificationToken and the sub-org
      // ID. Sub-org creation is gated here, after Turnkey validates the OTP.
      const { verificationToken, subOrgId } = await verifyOtpAction({
        otpId,
        encryptedOtpBundle,
      });

    // signature over the new key
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

    const session = await completeAuth({ otpId, otpEncryptionTargetBundle, publicKey, clientSignature });
    await storeSession({ sessionToken: session });

    // remove the otpId and otpEncryptionTargetBundle from local storage since we don't need them anymore
    window.localStorage.removeItem("turnkey_otp_id");
    window.localStorage.removeItem("turnkey_otp_encryption_target_bundle");
  };

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
            We’ve sent a magic link to{" "}
            <span className="font-medium">{email}</span>. Click it to finish
            signing in.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return <LoginPage />;
}
