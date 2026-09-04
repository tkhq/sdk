"use client";

import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import type { v1CreateMfaPolicyIntent, v1MfaPolicy } from "@turnkey/sdk-types";

/**
 * Scratch panel for one question: when an MFA policy on this sub-org user matches
 * `activity.resource == 'AUTH'`, is it evaluated at login?
 *
 * A passkey has to be enrolled first. Turnkey refuses to create a policy the user could
 * never satisfy: requiring PASSKEY with no authenticator on the user is rejected at
 * creation with "cannot satisfy mfa policy requirement".
 *
 * With the passkey enrolled, the next login answers the question:
 *   - login completes with no passkey prompt -> the policy was NOT evaluated
 *   - ACTIVITY_STATUS_AUTHENTICATORS_NEEDED  -> it WAS evaluated
 *
 * Add the passkey, create the policy, log out, then log back in once per login path on
 * the sign-in page.
 */
export default function MfaLab() {
  const { httpClient, user, session, handleAddPasskey } = useTurnkey();
  const hasPasskey = (user?.authenticators?.length ?? 0) > 0;

  const [policies, setPolicies] = useState<v1MfaPolicy[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const mfaPolicy: v1CreateMfaPolicyIntent = {
    userId: user?.userId ?? "",
    mfaPolicyName: "AUTH requires passkey",
    condition: "activity.resource == 'AUTH'",
    requiredAuthenticationMethods: [
      { any: [{ type: "AUTHENTICATION_TYPE_PASSKEY" }] },
    ],
    order: 0,
  };

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      setMsg(await fn());
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const cause =
        e instanceof Error && e.cause instanceof Error
          ? `\n${e.cause.message}`
          : "";
      setErr(`${label}: ${message}${cause}`);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    const { mfaPolicies } = await httpClient!.getMfaPolicies({
      userId: session!.userId,
      organizationId: session!.organizationId,
    });
    setPolicies(mfaPolicies);
    return `${mfaPolicies.length} policy/policies on this user.`;
  };

  const create = async () => {
    await httpClient!.createMfaPolicy(mfaPolicy);
    await refresh();
    return "Created. Now log out and sign in again with each login path.";
  };

  const deleteAll = async () => {
    const { mfaPolicies } = await httpClient!.getMfaPolicies({
      userId: session!.userId,
      organizationId: session!.organizationId,
    });
    for (const policy of mfaPolicies) {
      await httpClient!.deleteMfaPolicy({
        userId: session!.userId,
        organizationId: session!.organizationId,
        mfaPolicyId: policy.mfaPolicyId,
      });
    }
    await refresh();
    return `Deleted ${mfaPolicies.length}.`;
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">
          MFA on AUTH: is it evaluated at login?
        </h2>
        <p className="mt-1 text-xs text-gray-600">
          Enrol a passkey, then create a policy requiring a passkey for any AUTH
          activity. Log out, then sign in once with each login path and compare
          the reported activity status. A login that completes with no passkey
          prompt never evaluated the policy.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            run("add passkey", async () => {
              await handleAddPasskey();
              return "Passkey enrolled. Now create the policy.";
            })
          }
          disabled={busy}
          className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
        >
          1. Add passkey{hasPasskey ? " (already enrolled)" : ""}
        </button>
        <button
          onClick={() => run("create", create)}
          disabled={busy || !user?.userId || !hasPasskey}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          title={
            hasPasskey
              ? undefined
              : "Turnkey rejects a policy the user cannot satisfy, so enrol a passkey first."
          }
        >
          2. Create AUTH + passkey policy
        </button>
        <button
          onClick={() => run("refresh", refresh)}
          disabled={busy}
          className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
        >
          List policies
        </button>
        <button
          onClick={() => run("delete", deleteAll)}
          disabled={busy}
          className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
        >
          Delete all policies
        </button>
      </div>

      {msg && (
        <div className="rounded border border-green-300 bg-green-50 p-2 text-xs text-green-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="whitespace-pre-wrap rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {err}
        </div>
      )}
      {policies && (
        <pre className="max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
          {JSON.stringify(policies, null, 2)}
        </pre>
      )}
    </section>
  );
}
