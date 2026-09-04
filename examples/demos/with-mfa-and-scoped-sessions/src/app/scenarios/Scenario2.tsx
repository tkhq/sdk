"use client";

import { useTurnkey, ClientState, OtpType } from "@turnkey/react-wallet-kit";
import type { v1CreateMfaPolicyIntent } from "@turnkey/sdk-types";
import { useEffect, useState } from "react";
import {
  Checklist,
  DangerButton,
  formatError,
  Notice,
  OrDivider,
  Panel,
  PolicyGrid,
  PolicySummary,
  PrimaryButton,
  ScenarioCard,
  ScenarioHeader,
  SecondaryButton,
  SessionInfo,
  StatusNotices,
  SuccessDialog,
  TextInput,
} from "./ui";
import {
  deleteAllMfaPolicies,
  otpMfaLogin,
  passkeyMfaHandler,
  setupChecklistItems,
} from "./mfa";
import { DeleteSubOrg } from "./DeleteSubOrg";

export const SESSION_KEY = "scenario-2";

export default function Scenario2() {
  const {
    handleLogin,
    handleAddPasskey,
    handleSignMessage,
    initOtp,
    verifyOtp,
    storeSession,
    refreshUser,
    logout,
    allSessions,
    user,
    wallets,
    config,
    clientState,
    httpClient,
    setMfaHandler,
  } = useTurnkey();

  const session = allSessions?.[SESSION_KEY];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdPolicies, setCreatedPolicies] = useState<
    v1CreateMfaPolicyIntent[] | null
  >(null);
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

  // Same handler as Scenario 1, deliberately. Here it stays quiet: the catch-all policy below
  // is satisfied by the session stamp alone, so signing never reaches AUTHENTICATORS_NEEDED.
  // Same code, different policy, different experience. It is still wired to the status notices
  // so that if it ever does fire, the card says so rather than prompting out of nowhere.
  useEffect(() => {
    if (!httpClient) return;

    setMfaHandler(passkeyMfaHandler(httpClient, setMfaStatus));

    return () => setMfaHandler(undefined);
  }, [httpClient, setMfaHandler]);

  const mfaPolicy1: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require OTP + passkey for auth",
    condition: "activity.resource == 'AUTH'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_EMAIL_OTP" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 0,
  };

  const mfaPolicy2: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require session for everything else",
    condition: "true",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
    ],
    order: 1,
  };

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await fn();
    } catch (e) {
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

    const sessionToken = await otpMfaLogin({
      httpClient: httpClient!,
      verifyOtp,
      otpId,
      otpCode,
      otpEncryptionTargetBundle,
      contact: normalizedEmail,
      parentOrganizationId: config?.organizationId,
      onOtpVerified: () => setOtpVerified(true),
      onProgress: setMfaStatus,
    });

    // The activity path returns the session JWT but doesn't persist it, store
    // it under our session key so the UI picks it up.
    await storeSession({ sessionToken, sessionKey: SESSION_KEY });
  };

  const createMfaPolicies = async () => {
    await httpClient!.createMfaPolicy(mfaPolicy1);
    await httpClient!.createMfaPolicy(mfaPolicy2);
    setCreatedPolicies([mfaPolicy1, mfaPolicy2]);
    await refreshUser();
  };

  const signMessage = async () => {
    await handleSignMessage({
      message: "turnkey mfa test " + Date.now(),
      walletAccount: wallets[0].accounts![0],
    });
    setNotice(
      "Signed with no passkey prompt. The session alone satisfied the catch-all policy.",
    );
  };

  const resetMfaPolicies = async () => {
    const deleted = await deleteAllMfaPolicies(httpClient!, {
      userId: session!.userId,
      organizationId: session!.organizationId,
    });
    await refreshUser();
    setNotice(`Deleted ${deleted} MFA polic${deleted === 1 ? "y" : "ies"}.`);
  };

  return (
    <ScenarioCard>
      <ScenarioHeader
        title="Scenario 2"
        subtitle="Require two factors to log in, then stay out of the way"
        description="Logging in needs an email OTP and a passkey. Everything after that is authorized by the session alone, so the user is never prompted again during normal use. Sign a message once you are back in to see it."
      />

      {session && <SessionInfo session={session} />}

      {session ? (
        <>
          <Checklist items={setupChecklistItems(user)} />

          <PrimaryButton
            disabled={loading}
            onClick={() => run(() => handleAddPasskey().then(() => {}))}
          >
            1. Add Passkey
          </PrimaryButton>

          <div className="w-full flex flex-col gap-2">
            <PrimaryButton
              disabled={loading || !user?.userId}
              onClick={() => run(createMfaPolicies)}
            >
              2. Create MFA Policies
            </PrimaryButton>
            <PolicyGrid policies={[mfaPolicy1, mfaPolicy2]} />
          </div>

          {/* The payoff: the same action that prompts in Scenario 1 stays silent here. */}
          <PrimaryButton
            disabled={loading || !wallets?.[0]?.accounts?.[0]}
            onClick={() => run(signMessage)}
          >
            Sign Message (session only, no passkey prompt)
          </PrimaryButton>

          <SecondaryButton
            disabled={loading}
            onClick={() => run(resetMfaPolicies)}
          >
            Reset MFA policies
          </SecondaryButton>

          <DeleteSubOrg
            sessionKey={SESSION_KEY}
            organizationId={session.organizationId}
          />

          {clientState === ClientState.Ready && (
            <DangerButton onClick={() => logout({ sessionKey: SESSION_KEY })}>
              3. Logout Before Testing Auth
            </DangerButton>
          )}
        </>
      ) : (
        <div className="w-full flex flex-col gap-4">
          <Panel
            title="Set this scenario up"
            hint="Start here on a new email. Creates the sub-organization and signs you in, so you can add a passkey and the MFA policies. No MFA yet: the policies do not exist until you create them."
          >
            {clientState === ClientState.Ready && (
              <SecondaryButton
                disabled={loading}
                onClick={() => handleLogin({ sessionKey: SESSION_KEY })}
              >
                Setup Login / Sign Up
              </SecondaryButton>
            )}
          </Panel>

          <OrDivider />

          <Panel
            title="Test the MFA login"
            hint="Come back here after setup and logout, with the same email. This is the flow the policies gate: an email OTP, then a passkey approval."
          >
            <div className="w-full flex flex-col gap-2">
              <TextInput
                value={email}
                onChange={setEmail}
                placeholder="Email"
              />
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
          </Panel>
        </div>
      )}

      {notice && <Notice tone="success">{notice}</Notice>}

      <StatusNotices
        otpSent={!!otpId}
        otpVerified={otpVerified}
        mfaStatus={mfaStatus}
        error={error}
      />

      <SuccessDialog
        open={!!createdPolicies}
        title="MFA policies created"
        description="Both are live on your Turnkey user. Logging in now needs OTP + passkey; everything after that needs only the session. Only the first policy whose condition matches applies, which is why the catch-all sits last."
        onClose={() => setCreatedPolicies(null)}
      >
        <PolicySummary policies={createdPolicies ?? []} />
      </SuccessDialog>
    </ScenarioCard>
  );
}
