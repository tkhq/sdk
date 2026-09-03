"use client";

import {
  useTurnkey,
  ClientState,
  OtpType,
  StamperType,
} from "@turnkey/react-wallet-kit";
import { v1CreateMfaPolicyIntent } from "@turnkey/sdk-types";
import { useState } from "react";
import {
  DangerButton,
  formatError,
  PolicyGrid,
  PrimaryButton,
  ScenarioCard,
  ScenarioHeader,
  SecondaryButton,
  SessionInfo,
  StatusNotices,
  TextInput,
} from "./ui";

export const SESSION_KEY = "scenario-2";

export default function Scenario2() {
  const {
    handleLogin,
    handleAddPasskey,
    initOtp,
    verifyOtp,
    storeSession,
    logout,
    allSessions,
    user,
    clientState,
    httpClient,
  } = useTurnkey();

  const session = allSessions?.[SESSION_KEY];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otpEncryptionTargetBundle, setOtpEncryptionTargetBundle] = useState<
    string | null
  >(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<"idle" | "requested" | "approved">(
    "idle",
  );
  const normalizedEmail = email.trim();
  const emailHasWhitespace = /\s/.test(email);

  const mfaPolicy1 = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require OTP + passkey for auth",
    condition: "activity.resource == 'AUTH'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_EMAIL_OTP" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 0,
  } as v1CreateMfaPolicyIntent;

  const mfaPolicy2 = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require session for everything else",
    condition: "true",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
    ],
    order: 1,
  } as v1CreateMfaPolicyIntent;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = () => {
    if (!normalizedEmail) {
      throw new Error("Enter an email address first.");
    }
    if (emailHasWhitespace) {
      throw new Error("Email cannot contain spaces.");
    }
  };

  const sendEmailOtp = async () => {
    validateEmail();

    // Proxy OTP - sends the email and returns the OTP id + encryption bundle.
    const { otpId, otpEncryptionTargetBundle } = await initOtp({
      otpType: OtpType.Email,
      contact: normalizedEmail,
    });

    setOtpId(otpId);
    setOtpEncryptionTargetBundle(otpEncryptionTargetBundle);
    setOtpVerified(false);
    setMfaStatus("idle");
  };

  const verifyOtpAndLogin = async () => {
    if (!otpId || !otpEncryptionTargetBundle) {
      throw new Error("Send an email OTP first.");
    }

    // Verify the OTP to get the verification token.
    const { verificationToken, publicKey } = await verifyOtp({
      otpId,
      otpCode,
      otpEncryptionTargetBundle,
    });
    setOtpVerified(true);

    // Resolve the sub-org this email lives on (the verification token authorizes
    // the PII lookup). Every request below targets this sub-org.
    const { organizationId: subOrgId } = await httpClient!.proxyGetAccount({
      filterType: "EMAIL",
      filterValue: normalizedEmail,
      verificationToken,
    });
    if (!subOrgId) {
      throw new Error("No sub-organization found for this email.");
    }
    if (subOrgId === httpClient!.config.organizationId) {
      throw new Error(
        "OTP resolved to the parent organization. Run setup with this email to create a sub-organization before testing MFA login.",
      );
    }

    const signedLoginRequest = await httpClient!.stampStampLogin(
      { organizationId: subOrgId, publicKey },
      StamperType.Attested,
    );
    if (!signedLoginRequest) {
      throw new Error("Failed to create OTP login request.");
    }

    const loginResponse = await fetch(signedLoginRequest.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [signedLoginRequest.stamp.stampHeaderName]:
          signedLoginRequest.stamp.stampHeaderValue,
      },
      body: signedLoginRequest.body,
    });
    if (!loginResponse.ok) {
      throw new Error(await loginResponse.text());
    }

    let otpLoginRes = await loginResponse.json();
    if (
      otpLoginRes?.activity?.status === "ACTIVITY_STATUS_AUTHENTICATORS_NEEDED"
    ) {
      setMfaStatus("requested");
      await httpClient!.approveActivity(
        {
          fingerprint: otpLoginRes.activity.fingerprint,
          organizationId: subOrgId,
        },
        StamperType.Passkey,
      );
      setMfaStatus("approved");

      otpLoginRes = await httpClient!.getActivity(
        {
          activityId: otpLoginRes.activity.id,
          organizationId: subOrgId,
        },
        StamperType.Attested,
      );
    }

    const session = otpLoginRes?.activity?.result?.stampLoginResult?.session;
    if (!session) {
      throw new Error(
        `OTP login did not return a session (activity status: ${otpLoginRes?.activity?.status}).`,
      );
    }

    // The activity path returns the session JWT but doesn't persist it, store
    // it under our session key so the UI picks it up.
    await storeSession({ sessionToken: session, sessionKey: SESSION_KEY });
  };

  const createMfaPolicies = async () => {
    await httpClient!.createMfaPolicy(mfaPolicy1);
    await httpClient!.createMfaPolicy(mfaPolicy2);
  };

  return (
    <ScenarioCard>
      <ScenarioHeader
        title="Scenario 2"
        subtitle="MFA login, no re-auth for later actions"
      />

      {session && <SessionInfo session={session} />}

      {session ? (
        <>
          <PrimaryButton
            disabled={loading}
            onClick={() => run(() => handleAddPasskey().then(() => {}))}
          >
            1. Add Passkey
          </PrimaryButton>

          <div className="w-full flex flex-col gap-2">
            <PrimaryButton
              disabled={loading}
              onClick={() => run(createMfaPolicies)}
            >
              2. Create MFA Policies
            </PrimaryButton>
            <PolicyGrid policies={[mfaPolicy1, mfaPolicy2]} />
          </div>

          {clientState === ClientState.Ready && (
            <DangerButton onClick={() => logout({ sessionKey: SESSION_KEY })}>
              3. Logout Before Testing Auth
            </DangerButton>
          )}
        </>
      ) : (
        <div className="w-full flex flex-col gap-4">
          {clientState === ClientState.Ready && !otpId && (
            <SecondaryButton
              onClick={() => handleLogin({ sessionKey: SESSION_KEY })}
            >
              Setup Login / Sign Up
            </SecondaryButton>
          )}

          <div className="w-full flex flex-col gap-2">
            <TextInput value={email} onChange={setEmail} placeholder="Email" />
            <PrimaryButton
              disabled={loading || !normalizedEmail || emailHasWhitespace}
              onClick={() => run(sendEmailOtp)}
            >
              1. Send Email OTP
            </PrimaryButton>
          </div>

          <div className="w-full flex flex-col gap-2">
            <TextInput
              value={otpCode}
              onChange={setOtpCode}
              placeholder="OTP code"
            />
            <PrimaryButton
              disabled={loading || !otpId || !otpCode}
              onClick={() => run(verifyOtpAndLogin)}
            >
              2. Verify OTP + Passkey Login
            </PrimaryButton>
          </div>
        </div>
      )}

      <StatusNotices
        otpSent={!!otpId}
        otpVerified={otpVerified}
        mfaStatus={mfaStatus}
        error={error}
      />
    </ScenarioCard>
  );
}
