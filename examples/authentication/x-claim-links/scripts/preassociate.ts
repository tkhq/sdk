import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { DEFAULT_SOLANA_ACCOUNTS } from "@turnkey/sdk-server";
import { backendSignDenyPolicy } from "../src/lib/policies";
import {
  backendPublicKey,
  parentOrganizationId,
  turnkeyClient,
} from "../src/lib/turnkey-server";
import { resolveXTargets } from "../src/lib/xid";

async function main() {
  const values = process.argv.slice(2);
  if (values.length === 0) throw new Error("usage: pnpm preassociate -- handle:numeric_id [...]");
  const targets = await resolveXTargets(values);
  const parentId = parentOrganizationId();
  const parent = turnkeyClient();
  const candidates = await parent.getSubOrgIds({
    organizationId: parentId,
    filterType: "PUBLIC_KEY",
    filterValue: backendPublicKey(),
  });

  for (const target of targets) {
    const marker = `claim:x:${target.numericId}`;
    let existing: string | undefined;
    for (const organizationId of candidates.organizationIds) {
      const { organizationData } = await turnkeyClient(organizationId).getOrganization({ organizationId });
      if (organizationData.name?.includes(marker)) existing = organizationId;
    }
    if (existing) {
      console.log(`SKIP @${target.handle} ${target.numericId}: ${existing}`);
      continue;
    }

    const name = `allocation:${marker}:@${target.handle}`;
    const created = await parent.createSubOrganization({
      subOrganizationName: name,
      rootQuorumThreshold: 1,
      rootUsers: [{
        userName: "Allocation backend (temporary root)",
        apiKeys: [{
          apiKeyName: "Allocation backend P-256 key",
          publicKey: backendPublicKey(),
          curveType: "API_KEY_CURVE_P256",
        }],
        authenticators: [],
        oauthProviders: [],
      }],
      wallet: { walletName: `${name}:solana`, accounts: [...DEFAULT_SOLANA_ACCOUNTS] },
    });
    const subOrgId = created.subOrganizationId;
    const backendUserId = created.rootUserIds?.[0];
    if (!subOrgId || !backendUserId) throw new Error("incomplete createSubOrganization result");
    await turnkeyClient(subOrgId).createPolicy(backendSignDenyPolicy(backendUserId));
    const depositAddress = created.wallet?.addresses?.[0];
    if (!depositAddress) throw new Error("created Solana wallet has no deposit address");
    console.log(`CREATED @${target.handle} ${target.numericId}: http://127.0.0.1:3456/claim/${subOrgId}`);
    console.log(`SOLANA ADDRESS (DO NOT FUND BEFORE CLAIM GATES PASS): ${depositAddress}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
