/**
 * Claims every available reward on the configured network in two steps:
 *   1. getRewardsTransactionsContext returns claimable rewards keyed by
 *      network, each with a unique claimId.
 *   2. getRewardsClaimActions takes the claimIds and returns ready-to-sign
 *      transactions per network.
 *
 * Note: reward claim transactions may target different contracts than the
 * deposit/redeem flows. If you scoped the policy in createPolicy.ts to only
 * deposit/redeem targets, you'll need to extend or add a policy with the
 * reward target addresses before this can succeed.
 *
 * Run with: pnpm claimRewards
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { base } from "viem/chains";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import {
  createWalletClient,
  createPublicClient,
  http,
  type Account,
} from "viem";
import { VaultsSdk } from "@vaultsfyi/sdk";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.TURNKEY_BASE_URL!,
    apiPrivateKey: process.env.NONROOT_API_PRIVATE_KEY!,
    apiPublicKey: process.env.NONROOT_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const walletClient = createWalletClient({
    account: turnkeyAccount as Account,
    chain: base,
    transport: http(process.env.RPC_URL!),
  });

  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL!),
  });

  const vaultsFyi = new VaultsSdk({ apiKey: process.env.VAULTS_FYI_API_KEY! });

  const userAddress = (turnkeyAccount as Account).address;
  const targetNetwork = "base" as const;

  const context = await vaultsFyi.getRewardsTransactionsContext({
    path: { userAddress },
  });
  const networkRewards = context.claimable[targetNetwork] ?? [];

  if (networkRewards.length === 0) {
    console.log(`No claimable rewards on ${targetNetwork}.`);
    return;
  }

  console.log(
    `Found ${networkRewards.length} claimable reward(s) on ${targetNetwork}:`,
  );
  for (const reward of networkRewards) {
    const sources = reward.sources.map((s) => s.protocol.name).join(", ");
    console.log(
      `  - ${reward.asset.claimableAmount} ${reward.asset.symbol} from ${sources} (claimId: ${reward.claimId})`,
    );
  }

  const claimIds = networkRewards.map((r) => r.claimId);
  const claim = await vaultsFyi.getRewardsClaimActions({
    path: { userAddress },
    query: { claimIds },
  });
  const networkClaim = claim[targetNetwork];

  if (!networkClaim || networkClaim.actions.length === 0) {
    console.log("vaults.fyi returned no claim transactions.");
    return;
  }

  const remaining = networkClaim.actions.slice(networkClaim.currentActionIndex);
  console.log(`\nExecuting ${remaining.length} claim transaction(s):`);
  for (const step of remaining) {
    const hash = await walletClient.sendTransaction({
      to: step.tx.to as `0x${string}`,
      data: step.tx.data as `0x${string}` | undefined,
      value: step.tx.value ? BigInt(step.tx.value) : undefined,
    });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });
    console.log(`  ${step.name}: https://basescan.org/tx/${hash}`);
  }

  console.log("\nClaim complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
