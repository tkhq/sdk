"use client";

import { useTurnkey, ClientState, OtpType } from "@turnkey/react-wallet-kit";
import type { v1CreateMfaPolicyIntent } from "@turnkey/sdk-types";
import { useState } from "react";
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

export const SESSION_KEY = "scenario-3";

export default function Scenario3() {
  const {
    handleLogin,
    handleAddPasskey,
    handleExportWallet,
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
    setMfaHandler,
    httpClient,
  } = useTurnkey();

  const session = allSessions?.[SESSION_KEY];
  const wallet = wallets?.[0];
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
  const [exportCompleted, setExportCompleted] = useState(false);
  const normalizedEmail = email.trim();
  const emailHasWhitespace = /\s/.test(email);

  const authMfaPolicy: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require OTP + passkey for auth",
    condition: "activity.resource == 'AUTH'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_EMAIL_OTP" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 0,
  };

  const exportMfaPolicy: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require session + passkey for export",
    condition: "activity.action == 'EXPORT'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 1,
  };

  const sessionMfaPolicy: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require session for everything else",
    condition: "true",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
    ],
    order: 2,
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

  // Unlike Scenario 1 (handler installed for the whole session), here the passkey MFA
  // handler is only active around the wrapped call. The export activity comes back
  // AUTHENTICATORS_NEEDED, this handler approves it with the passkey, then it is torn down
  // so nothing else silently prompts for a passkey.
  const runWithPasskeyMfa = async (fn: () => Promise<void>) => {
    if (!httpClient) {
      throw new Error("Turnkey client is not ready.");
    }

    setMfaHandler(passkeyMfaHandler(httpClient, setMfaStatus));

    try {
      await fn();
    } finally {
      setMfaHandler(undefined);
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
    setExportCompleted(false);
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

    // The activity path returns the session JWT but doesn't persist it — store
    // it under our session key so the UI picks it up.
    await storeSession({ sessionToken, sessionKey: SESSION_KEY });
  };

  const createMfaPolicies = async () => {
    await httpClient!.createMfaPolicy(authMfaPolicy);
    await httpClient!.createMfaPolicy(exportMfaPolicy);
    await httpClient!.createMfaPolicy(sessionMfaPolicy);
    setCreatedPolicies([authMfaPolicy, exportMfaPolicy, sessionMfaPolicy]);
    await refreshUser();
  };

  const resetMfaPolicies = async () => {
    const deleted = await deleteAllMfaPolicies(httpClient!, {
      userId: session!.userId,
      organizationId: session!.organizationId,
    });
    await refreshUser();
    setNotice(`Deleted ${deleted} MFA polic${deleted === 1 ? "y" : "ies"}.`);
  };

  const exportWalletWithMfa = async () => {
    if (!wallet?.walletId) {
      throw new Error("No wallet on this user to export.");
    }

    setMfaStatus("idle");
    setExportCompleted(false);

    // handleExportWallet opens the kit's export modal, which owns the iframe and
    // decrypts the bundle inside it, so the key material never touches this app.
    // The export trips the EXPORT policy, and the passkey handler installed by
    // runWithPasskeyMfa approves it mid-flight.
    await handleExportWallet({
      walletId: wallet.walletId,
      ...(session?.organizationId && {
        organizationId: session.organizationId,
      }),
    });

    setExportCompleted(true);
  };

  return (
    <ScenarioCard>
      <ScenarioHeader
        title="Scenario 3"
        subtitle="Two factors to log in, and again to export a wallet"
        description="Logging in needs an email OTP and a passkey. Day-to-day activity needs only the session, but exporting the wallet steps back up to a second passkey approval, because export hands over the keys themselves."
      />

      {session && (
        <SessionInfo session={session}>
          {wallet?.walletId && <div>Wallet: {wallet.walletId}</div>}
        </SessionInfo>
      )}

      {session ? (
        <>
          <Checklist items={setupChecklistItems(user)} />

          <PrimaryButton
            disabled={loading}
            onClick={() =>
              run(() =>
                handleAddPasskey({
                  name: `Scenario 3 ${Date.now()}`,
                  displayName: "Scenario 3",
                }).then(() => {}),
              )
            }
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
            <PolicyGrid
              policies={[authMfaPolicy, exportMfaPolicy, sessionMfaPolicy]}
            />
          </div>

          <PrimaryButton
            disabled={loading || !wallet?.walletId}
            onClick={() => run(() => runWithPasskeyMfa(exportWalletWithMfa))}
          >
            3. Export Wallet (triggers passkey MFA)
          </PrimaryButton>

          {!wallet?.walletId && (
            <Notice>
              This user has no wallet yet. Sign-up creates one automatically, so
              this usually means setup did not finish.
            </Notice>
          )}

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
            <DangerButton
              disabled={loading}
              onClick={() => logout({ sessionKey: SESSION_KEY })}
            >
              Logout Before Testing Auth
            </DangerButton>
          )}
        </>
      ) : (
        <div className="w-full flex flex-col gap-4">
          <Panel
            title="Set this scenario up"
            hint="Start here on a new email. Creates the sub-organization, its wallet, and a session, so you can add a passkey and the MFA policies. No MFA yet: the policies do not exist until you create them."
          >
            {clientState === ClientState.Ready && (
              <SecondaryButton
                disabled={loading}
                onClick={() => handleLogin({ sessionKey: SESSION_KEY })}
              >
                Initial Setup Login / Sign Up
              </SecondaryButton>
            )}
          </Panel>

          <OrDivider />

          <Panel
            title="Test the MFA login"
            hint="Come back here after setup and logout, with the same email. This is the flow the policies gate: an email OTP, then a passkey approval. Exporting afterwards asks for the passkey again."
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
        exportCompleted={exportCompleted}
        error={error}
      />

      <SuccessDialog
        open={!!createdPolicies}
        title="MFA policies created"
        description="All three are live on your Turnkey user. Login needs OTP + passkey, export needs the session plus another passkey, everything else needs only the session. Only the first policy whose condition matches applies, which is why the catch-all sits last."
        onClose={() => setCreatedPolicies(null)}
      >
        <PolicySummary policies={createdPolicies ?? []} />
      </SuccessDialog>
    </ScenarioCard>
  );
}
