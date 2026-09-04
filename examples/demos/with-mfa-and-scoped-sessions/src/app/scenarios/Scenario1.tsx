"use client";

import { useTurnkey, ClientState } from "@turnkey/react-wallet-kit";
import type { v1CreateMfaPolicyIntent } from "@turnkey/sdk-types";
import { useEffect, useState } from "react";
import {
  Checklist,
  DangerButton,
  formatError,
  Notice,
  PolicyGrid,
  PolicySummary,
  PrimaryButton,
  ScenarioCard,
  ScenarioHeader,
  SecondaryButton,
  SessionInfo,
  SuccessDialog,
} from "./ui";
import {
  deleteAllMfaPolicies,
  passkeyMfaHandler,
  setupChecklistItems,
} from "./mfa";
import { DeleteSubOrg } from "./DeleteSubOrg";

export const SESSION_KEY = "scenario-1";

export default function Scenario1() {
  const {
    handleLogin,
    handleAddPasskey,
    handleSignMessage,
    refreshUser,
    logout,
    allSessions,
    user,
    wallets,
    httpClient,
    clientState,
    setMfaHandler,
  } = useTurnkey();

  const session = allSessions?.[SESSION_KEY];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdPolicies, setCreatedPolicies] = useState<
    v1CreateMfaPolicyIntent[] | null
  >(null);

  // The SIGN activity trips the MFA policy (SESSION is satisfied by the session stamp,
  // PASSKEY is still required), so it comes back AUTHENTICATORS_NEEDED. The handler reads
  // what is still outstanding and satisfies it with the passkey.
  useEffect(() => {
    if (!httpClient) return;

    setMfaHandler(passkeyMfaHandler(httpClient));

    return () => setMfaHandler(undefined);
  }, [httpClient, setMfaHandler]);

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

  if (clientState !== ClientState.Ready) return null;

  const mfaPolicy: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Require session + passkey for signing",
    condition: "activity.action == 'SIGN'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 0,
  };

  const createMfaPolicy = async () => {
    await httpClient!.createMfaPolicy(mfaPolicy);
    setCreatedPolicies([mfaPolicy]);
    await refreshUser();
  };

  const signMessage = async () => {
    await handleSignMessage({
      message: "turnkey mfa test " + Date.now(),
      walletAccount: wallets[0].accounts![0],
    });
    setNotice("Signed. The passkey prompt was the MFA step.");
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
        title="Scenario 1"
        subtitle="Require a second factor when signing"
        description="The user logs in once and works from a session. Signing a message needs that session plus a passkey approval, so the extra prompt lands only on the action worth interrupting for."
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
              onClick={() => run(createMfaPolicy)}
            >
              2. Create MFA Policy
            </PrimaryButton>
            <PolicyGrid policies={[mfaPolicy]} />
          </div>

          <PrimaryButton
            disabled={loading || !wallets?.[0]?.accounts?.[0]}
            onClick={() => run(signMessage)}
          >
            3. Sign Message (triggers MFA)
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

          <DangerButton onClick={() => logout({ sessionKey: SESSION_KEY })}>
            Logout
          </DangerButton>
        </>
      ) : (
        <SecondaryButton
          disabled={loading}
          onClick={() => run(() => handleLogin({ sessionKey: SESSION_KEY }))}
        >
          Login / Sign Up
        </SecondaryButton>
      )}

      {notice && <Notice tone="success">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <SuccessDialog
        open={!!createdPolicies}
        title="MFA policy created"
        description="It is live on your Turnkey user. Signing now needs a passkey on top of the session."
        onClose={() => setCreatedPolicies(null)}
      >
        <PolicySummary policies={createdPolicies ?? []} />
      </SuccessDialog>
    </ScenarioCard>
  );
}
