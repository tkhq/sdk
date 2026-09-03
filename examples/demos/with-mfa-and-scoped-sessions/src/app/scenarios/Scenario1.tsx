"use client";

import {
  useTurnkey,
  ClientState,
  StamperType,
} from "@turnkey/react-wallet-kit";
import { v1CreateMfaPolicyIntent } from "@turnkey/sdk-types";
import { useEffect, useState } from "react";
import {
  DangerButton,
  formatError,
  Notice,
  PolicyGrid,
  PrimaryButton,
  ScenarioCard,
  ScenarioHeader,
  SessionInfo,
} from "./ui";

export const SESSION_KEY = "scenario-1";

export default function Scenario1() {
  const {
    handleLogin,
    handleAddPasskey,
    handleSignMessage,
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

  // The SIGN activity trips the MFA policy (SESSION is satisfied by the session
  // stamp, PASSKEY is still required), so it comes back AUTHENTICATORS_NEEDED.
  // This handler approves it with the passkey to satisfy the second factor.
  useEffect(() => {
    if (!httpClient) return;

    setMfaHandler(async ({ fingerprint, organizationId }) => {
      await httpClient.approveActivity(
        { fingerprint, organizationId },
        StamperType.Passkey,
      );
    });

    return () => setMfaHandler(undefined);
  }, [httpClient, setMfaHandler]);

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

  if (clientState !== ClientState.Ready) return null;

  const mfaPolicy = {
    userId: user?.userId ?? "",
    mfaPolicyName: "Some policy",
    condition: "activity.action == 'SIGN'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_SESSION" }] },
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 0,
  } as v1CreateMfaPolicyIntent;

  return (
    <ScenarioCard>
      <ScenarioHeader
        title="Scenario 1"
        subtitle="MFA with session + passkey policy"
      />

      {session && <SessionInfo session={session} />}

      {/* 1. Login */}
      <PrimaryButton
        disabled={loading || !!session}
        onClick={() => run(() => handleLogin({ sessionKey: SESSION_KEY }))}
      >
        1. Login / Sign Up
      </PrimaryButton>

      {/* 2. Add passkey */}
      <PrimaryButton
        disabled={loading || !session}
        onClick={() => run(() => handleAddPasskey().then(() => {}))}
      >
        2. Add Passkey
      </PrimaryButton>

      {/* 3. Create MFA policy */}
      <div className="w-full flex flex-col gap-2">
        <PrimaryButton
          disabled={loading || !session}
          onClick={() =>
            run(() => httpClient!.createMfaPolicy(mfaPolicy).then(() => {}))
          }
        >
          3. Create MFA Policy
        </PrimaryButton>
        <PolicyGrid policies={[mfaPolicy]} />
      </div>

      {/* 4. Sign message */}
      <PrimaryButton
        disabled={loading || !session || !wallets?.[0]?.accounts?.[0]}
        onClick={() =>
          run(() =>
            handleSignMessage({
              message: "turnkey mfa test " + Date.now(),
              walletAccount: wallets[0].accounts![0],
            }).then(() => {}),
          )
        }
      >
        4. Sign Message (triggers MFA)
      </PrimaryButton>

      {error && <Notice tone="error">{error}</Notice>}

      {/* Logout */}
      <DangerButton
        disabled={!session}
        onClick={() => logout({ sessionKey: SESSION_KEY })}
      >
        Logout
      </DangerButton>
    </ScenarioCard>
  );
}
