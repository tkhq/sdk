"use client";

import {
  useTurnkey,
  ClientState,
  OtpType,
  StamperType,
} from "@turnkey/react-wallet-kit";
import { OAuthProviders } from "@turnkey/sdk-types";
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
import { deleteAllMfaPolicies, otpMfaLogin } from "./mfa";
import { DeleteSubOrg } from "./DeleteSubOrg";

export const SESSION_KEY = "scenario-4";

// Created once in the dashboard under Security > Session profiles, with
// scope: activity.kind == 'CREATE_AUTHENTICATORS'. See the README.
const RECOVERY_SESSION_PROFILE_ID =
  process.env.NEXT_PUBLIC_RECOVERY_SESSION_PROFILE_ID ?? "";

export default function Scenario4() {
  const {
    signUpWithPasskey,
    loginWithPasskey,
    handleAddEmail,
    handleAddOauthProvider,
    handleAddPasskey,
    handleGoogleOauth,
    handleSignMessage,
    overrideAttestedStamper,
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
  } = useTurnkey();

  const session = allSessions?.[SESSION_KEY];
  const inRecoverySession =
    !!session?.sessionProfileId &&
    session.sessionProfileId === RECOVERY_SESSION_PROFILE_ID;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [denial, setDenial] = useState<string | null>(null);
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

  // Turnkey rejects a policy the user cannot satisfy, so a missing factor here surfaces as
  // "cannot satisfy mfa policy requirement". Hence the checklist.
  const hasPasskey = (user?.authenticators?.length ?? 0) > 0;
  const recoveryEmail = user?.userEmail;
  const googleProvider = user?.oauthProviders?.find(
    (provider) => provider.issuer === "https://accounts.google.com",
  );
  const setupComplete = hasPasskey && !!recoveryEmail && !!googleProvider;

  // MFA policies live on the user, so they come back with `user` rather than needing a query.
  const mfaPolicies = user?.mfaPolicies ?? [];

  // Both come from the auth proxy config unless overridden locally, and Google needs both.
  const googleClientId = config?.auth?.oauthConfig?.google?.primaryClientId;
  const oauthRedirectUri = config?.auth?.oauthConfig?.oauthRedirectUri;
  const googleConfigured = !!googleClientId && !!oauthRedirectUri;

  // The session profile id is the only thing separating a recovery login from a normal one:
  // both are STAMP_LOGIN with resource AUTH, from the same user.
  const recoveryMfaPolicy: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Recovery: email OTP + Google",
    condition: `activity.resource == 'AUTH' && activity.params.session_profile_id == '${RECOVERY_SESSION_PROFILE_ID}'`,
    // Two entries, so both are required. Google has to be one of them: the login is itself
    // stamped with the email OTP, so asking for nothing else would be satisfied on arrival.
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_EMAIL_OTP" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_OAUTH" }] },
    ],
    order: 0,
  };

  // What makes the email OTP useless on its own: a login naming no profile falls through here.
  const normalLoginMfaPolicy: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Normal login requires the passkey",
    condition: "activity.resource == 'AUTH'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 1,
  };

  const catchAllMfaPolicy: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Everything else requires a session",
    condition: "true",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
    ],
    order: 2,
  };

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setDenial(null);
    setLoading(true);
    try {
      await fn();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOtp = async () => {
    if (!normalizedEmail) throw new Error("Enter an email address first.");
    if (emailHasWhitespace) throw new Error("Email cannot contain spaces.");

    const { otpId, otpEncryptionTargetBundle } = await initOtp({
      otpType: OtpType.Email,
      contact: normalizedEmail,
    });

    setOtpId(otpId);
    setOtpEncryptionTargetBundle(otpEncryptionTargetBundle);
    setOtpVerified(false);
    setMfaStatus("idle");
  };

  // onOauthSuccess short-circuits the login and just hands back the OIDC token, which is what
  // an MFA approval needs. It is typed `=> void` and invoked without await, so this has to
  // wrap it in a promise: otherwise the caller re-reads the activity before the approval has
  // landed. TODO(sdk): await it, as onAddProvider already is.
  const approveWithGoogle = (challenge: {
    fingerprint: string;
    organizationId: string;
  }) =>
    new Promise<void>((resolve, reject) => {
      let approvalStarted = false;

      handleGoogleOauth({
        onOauthSuccess: async ({ oidcToken, publicKey }) => {
          approvalStarted = true;
          try {
            await overrideAttestedStamper({ oidcToken, publicKey });
            await httpClient!.approveActivity(challenge, StamperType.Attested);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      })
        .then(() => {
          if (!approvalStarted) {
            reject(
              new Error(
                "The Google flow finished without returning a token. In redirect mode the page navigates away, so this scenario needs the popup flow.",
              ),
            );
          }
        })
        .catch(reject);
    });

  const recover = async (withRecoveryProfile: boolean) => {
    if (!otpId || !otpEncryptionTargetBundle) {
      throw new Error("Send an email OTP first.");
    }
    if (withRecoveryProfile && !RECOVERY_SESSION_PROFILE_ID) {
      throw new Error(
        "Set NEXT_PUBLIC_RECOVERY_SESSION_PROFILE_ID first. See the README.",
      );
    }

    const sessionToken = await otpMfaLogin({
      httpClient: httpClient!,
      verifyOtp,
      otpId,
      otpCode,
      otpEncryptionTargetBundle,
      contact: normalizedEmail,
      parentOrganizationId: config?.organizationId,
      ...(withRecoveryProfile
        ? {
            sessionProfileId: RECOVERY_SESSION_PROFILE_ID,
            approve: approveWithGoogle,
          }
        : {
            // Let the passkey prompt happen: it is the demonstration. Flag it first so it
            // does not appear out of nowhere.
            approve: async (challenge) => {
              setDenial(
                "This login named no recovery session profile, so it fell through to the order 1 policy, which requires the passkey. The prompt you are about to see is that policy asking for it. You still hold the passkey here, so you can complete it; a user who genuinely lost theirs would be stuck at exactly this point, which is why the recovery path exists.",
              );
              await httpClient!.approveActivity(challenge, StamperType.Passkey);
            },
          }),
      onOtpVerified: () => setOtpVerified(true),
      onProgress: setMfaStatus,
    });

    await storeSession({ sessionToken, sessionKey: SESSION_KEY });
  };

  const createMfaPolicies = async () => {
    if (!RECOVERY_SESSION_PROFILE_ID) {
      throw new Error(
        "Set NEXT_PUBLIC_RECOVERY_SESSION_PROFILE_ID first. See the README.",
      );
    }
    await httpClient!.createMfaPolicy(recoveryMfaPolicy);
    await httpClient!.createMfaPolicy(normalLoginMfaPolicy);
    await httpClient!.createMfaPolicy(catchAllMfaPolicy);
    setCreatedPolicies([
      recoveryMfaPolicy,
      normalLoginMfaPolicy,
      catchAllMfaPolicy,
    ]);
    // These were written with httpClient directly, so nothing refreshed `user` for us.
    await refreshUser();
  };

  // Denied by the session scope, before any policy is consulted.
  const trySigning = async () => {
    const account = wallets?.[0]?.accounts?.[0];
    if (!account) throw new Error("No wallet account to sign with.");

    try {
      await handleSignMessage({
        message: "should not be signable " + Date.now(),
        walletAccount: account,
      });
      setNotice(
        "Unexpected: the recovery session signed a message. Check that the session profile's scope is activity.kind == 'CREATE_AUTHENTICATORS'.",
      );
    } catch (e) {
      setDenial(
        `${formatError(e)}\n\nDenied by the session scope, not by a policy. The message talks about policies either way, which is worth knowing when you debug this.`,
      );
    }
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
        title="Scenario 4"
        subtitle="Recover a passkey-only account without weakening it"
        description="The user signs in with a passkey and nothing else. If they lose it, recovery takes an email OTP plus Google, and lands in a session that can only enrol a new credential. Recovery is a harder path than the front door, not a softer one."
      />

      {!RECOVERY_SESSION_PROFILE_ID && (
        <Notice tone="error">
          NEXT_PUBLIC_RECOVERY_SESSION_PROFILE_ID is not set. Create a session
          profile scoped to {`activity.kind == 'CREATE_AUTHENTICATORS'`} and put
          its id in .env.local. See the README.
        </Notice>
      )}

      {session && (
        <SessionInfo session={session}>
          {session.sessionProfileId && (
            <div>Profile: {session.sessionProfileId}</div>
          )}
          {session.scope && <div>Scope: {session.scope}</div>}
        </SessionInfo>
      )}

      {inRecoverySession ? (
        <>
          <Notice>
            This is a recovery session. Its scope allows enrolling a credential
            and nothing else.
          </Notice>

          <PrimaryButton
            disabled={loading}
            onClick={() =>
              run(async () => {
                await handleAddPasskey();
                setNotice(
                  "New passkey enrolled. Log out and sign in with it to get a full session.",
                );
              })
            }
          >
            1. Enrol a new passkey (allowed by the scope)
          </PrimaryButton>

          <PrimaryButton
            disabled={loading || !wallets?.[0]?.accounts?.[0]}
            onClick={() => run(trySigning)}
          >
            2. Try to sign a message (should be denied)
          </PrimaryButton>

          <DangerButton onClick={() => logout({ sessionKey: SESSION_KEY })}>
            Log out
          </DangerButton>
        </>
      ) : session ? (
        <>
          <Checklist
            items={[
              {
                label: "Passkey enrolled",
                done: hasPasskey,
                ...(hasPasskey && {
                  detail: `${user?.authenticators?.length} authenticator(s)`,
                }),
              },
              {
                label: "Recovery email set",
                done: !!recoveryEmail,
                detail: recoveryEmail
                  ? `${recoveryEmail} · set through the OTP flow, so it is verified. The API exposes the address but no verified flag, so this cannot be read back. Re-run step 1 to change it; submitting the same address again is rejected.`
                  : "Needed for the email OTP factor, and for the sub-org to be findable at recovery time.",
              },
              {
                label: "Google linked",
                done: !!googleProvider,
                detail: googleProvider
                  ? `${googleProvider.providerName} · subject ${googleProvider.subject}`
                  : "The second recovery factor, and the reason recovery is not just the inbox. Required: the policy asks for it, and Turnkey rejects a policy the user cannot satisfy.",
              },
              {
                label: "MFA policies created",
                done: mfaPolicies.length > 0,
                detail:
                  mfaPolicies.length > 0
                    ? mfaPolicies
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map(
                          (policy) =>
                            `${policy.order}. ${policy.mfaPolicyName}`,
                        )
                        .join(" · ")
                    : "Nothing is enforced until these exist.",
              },
            ]}
          />

          <PrimaryButton
            disabled={loading}
            onClick={() =>
              run(async () => {
                await handleAddEmail();
                setNotice(
                  "Recovery email set and verified. Verification matters: an unverified email cannot be found at recovery time.",
                );
              })
            }
          >
            1. Add or update the recovery email
          </PrimaryButton>

          {/* Once only, unlike the email: an identity maps to one sub-organization, so
              re-linking fails with "Account already exists with this OIDC token or claims". */}
          <PrimaryButton
            disabled={loading || !googleConfigured || !!googleProvider}
            onClick={() =>
              run(async () => {
                await handleAddOauthProvider({
                  providerName: OAuthProviders.GOOGLE,
                });
                setNotice("Google linked. It is the second recovery factor.");
              })
            }
          >
            {googleProvider ? "2. Google linked" : "2. Link Google"}
          </PrimaryButton>

          {!googleConfigured && (
            <Notice tone="error">
              {!googleClientId
                ? "No Google client ID in the resolved config. Enable Google on this organization's auth proxy config, or set NEXT_PUBLIC_GOOGLE_CLIENT_ID."
                : "Google is enabled, but no OAuth redirect URI resolved. Add one to the auth proxy config, or set NEXT_PUBLIC_OAUTH_REDIRECT_URI (http://localhost:3000 for local dev) and restart."}
            </Notice>
          )}

          <div className="w-full flex flex-col gap-2">
            <PrimaryButton
              disabled={loading || !user?.userId || !setupComplete}
              onClick={() => run(createMfaPolicies)}
            >
              3. Create MFA Policies
            </PrimaryButton>
            <PolicyGrid
              policies={[
                recoveryMfaPolicy,
                normalLoginMfaPolicy,
                catchAllMfaPolicy,
              ]}
            />
          </div>

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

          <DangerButton onClick={() => logout({ sessionKey: SESSION_KEY })}>
            4. Log out (pretend the passkey is lost)
          </DangerButton>
        </>
      ) : (
        <div className="w-full flex flex-col gap-4">
          <Panel
            title="Set this scenario up"
            hint="Creates a passkey-only account: no email login, no OAuth login, just a passkey. Then add the recovery factors and the policies."
          >
            {clientState === ClientState.Ready && (
              <>
                <SecondaryButton
                  disabled={loading}
                  onClick={() =>
                    run(() =>
                      signUpWithPasskey({
                        sessionKey: SESSION_KEY,
                        passkeyDisplayName: `Scenario 4 ${Date.now()}`,
                      }).then(() => {}),
                    )
                  }
                >
                  Sign up with a passkey
                </SecondaryButton>
                <SecondaryButton
                  disabled={loading}
                  onClick={() =>
                    run(() =>
                      loginWithPasskey({ sessionKey: SESSION_KEY }).then(
                        () => {},
                      ),
                    )
                  }
                >
                  Log in with the passkey
                </SecondaryButton>
              </>
            )}
          </Panel>

          <OrDivider />

          <Panel
            title="Recover a lost passkey"
            hint="Names the recovery session profile, so the order 0 policy applies: an email OTP plus Google. The result is a session that can only enrol a credential."
          >
            <div className="w-full flex flex-col gap-2">
              <TextInput
                value={email}
                onChange={setEmail}
                placeholder="Recovery email"
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
                onClick={() => run(() => recover(true))}
              >
                2. Recover with email OTP + Google
              </PrimaryButton>
            </div>

            <div className="w-full flex flex-col gap-1">
              <SecondaryButton
                disabled={loading || !otpId || !otpCode}
                onClick={() => run(() => recover(false))}
              >
                Log in with the OTP alone
              </SecondaryButton>
              <p className="text-center text-xs leading-5 text-gray-600">
                Names no session profile, so it falls through to the order 1
                policy and asks for the passkey instead.
              </p>
            </div>
          </Panel>
        </div>
      )}

      {notice && <Notice tone="success">{notice}</Notice>}
      {denial && <Notice tone="error">{denial}</Notice>}

      <StatusNotices
        otpSent={!!otpId}
        otpVerified={otpVerified}
        mfaStatus={mfaStatus}
        error={error}
      />

      <SuccessDialog
        open={!!createdPolicies}
        title="MFA policies created"
        description="Recovery now needs an email OTP and Google, a normal login needs the passkey, and everything else needs a session. Only the first matching policy applies, which is why the recovery rule sits at order 0."
        onClose={() => setCreatedPolicies(null)}
      >
        <PolicySummary policies={createdPolicies ?? []} />
      </SuccessDialog>
    </ScenarioCard>
  );
}
