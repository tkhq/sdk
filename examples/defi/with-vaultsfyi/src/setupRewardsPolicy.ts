import { Turnkey } from "@turnkey/sdk-server";
import { vaultsFyi, resolveNetwork } from "./shared";

const networkArg = process.argv[2];

if (!networkArg) {
  console.error("Usage: pnpm setup-rewards-policy <network>");
  process.exit(1);
}

async function main() {
  const { network } = resolveNetwork(networkArg!);

  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.TURNKEY_BASE_URL!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  }).apiClient();

  const userId = process.env.NONROOT_USER_ID!;
  const userAddress = process.env.SIGN_WITH!;

  const rewardsContext = await vaultsFyi.getRewardsTransactionsContext({
    path: { userAddress },
  });

  const rewards = rewardsContext.claimable[network] ?? [];

  if (rewards.length === 0) {
    console.log(
      `No claimable rewards on ${network} — nothing to build a policy for.`,
    );
    process.exit(0);
  }

  const claimIds = rewards.map((r) => r.claimId);
  const claim = await vaultsFyi.getRewardsClaimActions({
    path: { userAddress },
    query: { claimIds },
  });

  const targets = [
    ...new Set(claim[network].actions.map((a) => a.tx.to.toLowerCase())),
  ];
  const addressList = targets.map((a) => `'${a}'`).join(", ");

  console.log("Discovered reward claim addresses:", targets);

  const { policyId } = await turnkeyClient.createPolicy({
    policyName: `Allow non-root user to claim rewards on ${network}`,
    effect: "EFFECT_ALLOW",
    consensus: `approvers.any(user, user.id == '${userId}')`,
    condition: `eth.tx.to in [${addressList}]`,
    notes: "vaults.fyi cookbook: reward claim addresses",
  });

  console.log("Policy created:", policyId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
