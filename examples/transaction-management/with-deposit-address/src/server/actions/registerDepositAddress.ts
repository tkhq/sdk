"use server";

import {
  findSweepDestinations,
  parseAddress,
  parseDestination,
} from "@/lib/deposit";
import { saveDepositAddress } from "@/server/registry";
import { delegatedClient } from "@/server/turnkey";

export type RegisterResult = { ok: true } | { ok: false; error: string };

// Records which sub-organization owns a deposit address and where its sweeps
// go, so the webhook can act on it. The browser supplies the first two values,
// so the server checks them with the delegated key before saving: the key must
// belong to a user in that sub-org, that user must not be root, and the address
// must be one of the sub-org's wallet accounts. The destination is never taken
// from the browser. It is read from the two policies the user approved.
export async function registerDepositAddress(
  subOrgId: string,
  address: string,
): Promise<RegisterResult> {
  const depositAddress = parseAddress(address);
  if (!depositAddress) {
    return { ok: false, error: "Invalid deposit address." };
  }

  try {
    const client = delegatedClient(subOrgId);

    const { userId } = await client.getWhoami({ organizationId: subOrgId });

    const { configs } = await client.getOrganizationConfigs({
      organizationId: subOrgId,
    });
    if (configs.quorum?.userIds.includes(userId)) {
      return {
        ok: false,
        error: "The delegated user is in the root quorum. Refusing to sweep.",
      };
    }

    const { accounts } = await client.getWalletAccounts({
      organizationId: subOrgId,
    });
    const owned = accounts.some(
      (a) => parseAddress(a.address) === depositAddress,
    );
    if (!owned) {
      return { ok: false, error: "Address is not in this sub-organization." };
    }

    const { policies } = await client.getPolicies({ organizationId: subOrgId });
    const destinations = findSweepDestinations(policies, userId);
    if (destinations.length !== 1) {
      return {
        ok: false,
        error: `Expected one sweep destination, found ${destinations.length}.`,
      };
    }
    const destination = parseDestination(destinations[0], depositAddress);
    if (!destination.ok) {
      return { ok: false, error: destination.error };
    }

    await saveDepositAddress({
      address: depositAddress,
      subOrgId,
      destination: destination.address,
      delegatedUserId: userId,
      registeredAt: new Date().toISOString(),
    });
    console.log(
      `[register] ${depositAddress} -> sub-org ${subOrgId}, sweeps to ${destination.address}`,
    );
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Registration failed.";
    console.error(`[register] ${depositAddress}: ${error}`);
    return { ok: false, error };
  }
}
