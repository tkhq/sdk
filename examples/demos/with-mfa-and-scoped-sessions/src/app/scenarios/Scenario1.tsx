"use client";

import { useTurnkey, ClientState } from "@turnkey/react-wallet-kit";
import { v1CreateMfaPolicyIntent } from "@turnkey/sdk-types";
import { useState } from "react";

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
  } = useTurnkey();

  const session = allSessions?.[SESSION_KEY];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? String(e));
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
    <div className="flex flex-col items-center justify-center gap-6 w-full max-w-sm">
      <h2 className="text-xl font-semibold">Scenario 1</h2>
      <p className="text-sm text-gray-500 text-center">
        MFA with session + passkey policy
      </p>

      {session && (
        <div className="text-xs text-gray-400 font-mono text-center">
          <div>User: {session.userId}</div>
          <div>Org: {session.organizationId}</div>
        </div>
      )}

      {/* 1. Login */}
      <button
        disabled={loading || !!session}
        onClick={() => run(() => handleLogin({ sessionKey: SESSION_KEY }))}
        className="w-full rounded px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        1. Login / Sign Up
      </button>

      {/* 2. Add passkey */}
      <button
        disabled={loading || !session}
        onClick={() => run(() => handleAddPasskey().then(() => {}))}
        className="w-full rounded px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        2. Add Passkey
      </button>

      {/* 3. Create MFA policy */}
      <div className="w-full flex flex-col gap-2">
        <button
          disabled={loading || !session}
          onClick={() =>
            run(() => httpClient!.createMfaPolicy(mfaPolicy).then(() => {}))
          }
          className="w-full rounded px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          3. Create MFA Policy
        </button>
        <pre className="w-full rounded bg-gray-100 p-3 text-xs text-gray-600 overflow-x-auto">
          {JSON.stringify(mfaPolicy, null, 2)}
        </pre>
      </div>

      {/* 4. Sign message */}
      <button
        disabled={loading || !session || !wallets?.[0]?.accounts?.[0]}
        onClick={() =>
          run(() =>
            handleSignMessage({
              message: "turnkey mfa test " + Date.now(),
              walletAccount: wallets[0].accounts![0],
            }).then(() => {}),
          )
        }
        className="w-full rounded px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        4. Sign Message (triggers MFA)
      </button>

      {error && (
        <p className="text-xs text-red-500 text-center break-words">{error}</p>
      )}

      {/* Logout */}
      <button
        disabled={!session}
        onClick={() => logout({ sessionKey: SESSION_KEY })}
        className="w-full rounded px-4 py-2 text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Logout
      </button>
    </div>
  );
}
