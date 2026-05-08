/**
 * Creates a Turnkey policy that restricts the non-root user to interacting only
 * with the contract addresses vaults.fyi will actually target for this vault.
 *
 * Why a dry-run? For most ERC-4626 vaults (Morpho, Aave, Euler), deposits and
 * redemptions target the vault contract directly. But some protocols route
 * through intermediary contracts. For example, Veda Boring Vaults route through
 * a Teller, and protocols with cooldowns (Sky sUSDS, Ethena sUSDe) may route
 * redemptions through a different contract than deposits. Rather than guessing,
 * we ask vaults.fyi for sample deposit and redeem transactions and extract the
 * actual tx.to addresses from the responses. This gives us the exact allowlist
 * regardless of protocol.
 *
 * Run with: pnpm createPolicy
 */

import { Turnkey } from "@turnkey/sdk-server";
import { VaultsSdk } from "@vaultsfyi/sdk";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.TURNKEY_BASE_URL ?? "https://api.turnkey.com",
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  }).apiClient();

  const vaultsFyi = new VaultsSdk({ apiKey: process.env.VAULTS_FYI_API_KEY! });

  const userId = process.env.NONROOT_USER_ID!;
  const userAddress = process.env.SIGN_WITH!;
  const network = "base" as const;
  const vaultId = process.env.VAULT_ID!;
  const assetAddress = process.env.ASSET_ADDRESS!;

  // Dry-run deposit AND redeem in parallel. Some protocols route redemptions
  // through a different contract than deposits (queue contracts, etc.).
  console.log("Discovering target addresses for deposit and redeem...");
  const [deposit, redeem] = await Promise.all([
    vaultsFyi.getActions({
      path: { action: "deposit", userAddress, network, vaultId },
      query: { assetAddress, amount: "1" },
    }),
    vaultsFyi.getActions({
      path: { action: "redeem", userAddress, network, vaultId },
      query: { assetAddress, amount: "1" },
    }),
  ]);

  // Collect unique tx.to addresses across both actions.
  const targets = [
    ...new Set(
      [...deposit.actions, ...redeem.actions].map((a) => a.tx.to.toLowerCase()),
    ),
  ];

  console.log(`Found ${targets.length} target address(es):`);
  for (const addr of targets) {
    console.log(`  ${addr}`);
  }

  const addressList = targets.map((a) => `'${a}'`).join(", ");

  const { policyId } = await turnkeyClient.createPolicy({
    policyName: `Allow non-root user to interact with vault ${vaultId}`,
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${userId}')`,
    condition: `eth.tx.to in [${addressList}]`,
    notes: `vaults.fyi: auto-discovered addresses for vault ${vaultId} on ${network}`,
  });

  console.log(`\nCreated policy ${policyId}`);
  console.log(
    "\nTo support additional vaults, run this script again with a different" +
      " VAULT_ID, or attach more policies. Reward claims may target different" +
      " contracts — re-run after fetching rewards context if you start" +
      " claiming.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
