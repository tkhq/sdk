"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useTurnkey,
  AuthState,
  getClientSignatureMessageForLogin,
} from "@turnkey/react-wallet-kit";
import { generateP256KeyPair, encryptToEnclave } from "@turnkey/crypto";
import {
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
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

  // The key pair for this OTP attempt (need private key for client signature)
  const keyPairRef = useRef<{
    publicKey: string;
    privateKey: string;
  } | null>(null);

  // The encryption target bundle from initOtp, needed to encrypt the OTP code
  const encryptionTargetRef = useRef<string | null>(null);

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

      // 1) Generate a fresh P256 key pair for this OTP attempt.
      //    We need the private key later to build the client signature,
      //    so we generate it ourselves and register it with the stamper.
      const keyPair = generateP256KeyPair();
      const publicKey = await createApiKeyPair({
        externalKeyPair: {
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
        },
      });
      keyPairRef.current = { publicKey, privateKey: keyPair.privateKey };

      // reset any prior OTP attempt UI state
      setOtpCode("");
      setOtpId(null);

      setWorking("Sending code…");

      // 2) Kick off OTP with backend, binds this attempt to the current session key
      // Note: publicKey here is used (optionally) for rate limiting SMS OTP requests per user
      const { otpId, otpEncryptionTargetBundle } = await initOtpAction({
        email: trimmed,
        publicKey,
      });
      encryptionTargetRef.current = otpEncryptionTargetBundle;
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
      if (!keyPairRef.current || !encryptionTargetRef.current)
        throw new Error("Session key missing. Please resend the code.");

      setWorking("Verifying…");

      // 1) Encrypt the OTP code to the enclave's target key, then verify.
      //    The OTP code never leaves the client unencrypted.
      const targetBundle = JSON.parse(encryptionTargetRef.current);
      const targetData = JSON.parse(
        new TextDecoder().decode(uint8ArrayFromHexString(targetBundle.data)),
      );
      const payload = JSON.stringify({
        otpCode: otpCode.trim(),
        publicKey: keyPairRef.current.publicKey,
      });
      const encrypted = await encryptToEnclave(
        targetData.targetPublic,
        payload,
      );
      const encryptedOtpBundle = uint8ArrayToHexString(encrypted);

      const { verificationToken } = await verifyOtpAction({
        otpId,
        encryptedOtpBundle,
      });

      // 2) Find or create suborg for this email
      let suborgId = (await getSuborgsAction({ filterValue: email.trim() }))
        ?.organizationIds?.[0];
      if (!suborgId) {
        const created = await createSuborgAction({ email: email.trim() });
        suborgId = created.subOrganizationId;
      }

      // 3) Build the client signature proving we hold the private key
      const { publicKey, privateKey } = keyPairRef.current;
      const { message, publicKey: signingPublicKey } =
        getClientSignatureMessageForLogin({
          verificationToken,
          sessionPublicKey: publicKey,
        });

      const messageHash = sha256(new TextEncoder().encode(message));
      const signature = p256.sign(
        messageHash,
        uint8ArrayFromHexString(privateKey),
      );

      const clientSignature = {
        scheme: "CLIENT_SIGNATURE_SCHEME_API_P256" as const,
        publicKey: signingPublicKey,
        message,
        signature: signature.toCompactHex(),
      };

      // 4) Complete login with the client signature
      const { session } = await otpLoginAction({
        suborgID: suborgId!,
        verificationToken,
        publicKey,
        clientSignature,
      });

      // 5) Store session & go
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
