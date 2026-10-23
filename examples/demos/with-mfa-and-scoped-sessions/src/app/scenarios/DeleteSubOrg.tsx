"use client";

import { useState } from "react";
import { useTurnkey } from "@turnkey/react-wallet-kit";
import { DangerButton, Notice, SecondaryButton, formatError } from "./ui";

/**
 * Deletes the sub-organization this scenario created, so the same email or passkey can be
 * used again from scratch. Without it, re-running a scenario means a fresh email every time:
 * MFA policies, the recovery email and a linked Google account all persist on the user.
 *
 * The sub-organization has to delete itself. A parent-org API key cannot stamp this on its
 * behalf, so it only works while the scenario holds a full session, and not from Scenario 4's
 * recovery session, whose scope permits credential creation and nothing else.
 */
export function DeleteSubOrg({
  sessionKey,
  organizationId,
}: {
  sessionKey: string;
  organizationId: string;
}) {
  const { deleteSubOrganization, logout } = useTurnkey();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      // deleteWithoutExport is required: these wallets have never been exported, and the
      // delete is refused by default until they are.
      await deleteSubOrganization({
        deleteWithoutExport: true,
        organizationId,
      });
      await logout({ sessionKey });
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!armed) {
    return (
      <SecondaryButton disabled={busy} onClick={() => setArmed(true)}>
        Delete this sub-organization
      </SecondaryButton>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded border border-red-200 bg-red-50 p-3">
      <p className="text-xs text-black">
        Deletes the sub-organization and its wallets. Irreversible, and only
        sensible for the throwaway accounts this demo creates. It is the
        cleanest way to re-run a scenario with the same email.
      </p>
      <p className="break-all font-mono text-xs text-gray-700">
        {organizationId}
      </p>
      <div className="flex w-full gap-2">
        <SecondaryButton disabled={busy} onClick={() => setArmed(false)}>
          Cancel
        </SecondaryButton>
        <DangerButton disabled={busy} onClick={remove}>
          {busy ? "Deleting…" : "Yes, delete it"}
        </DangerButton>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
