import {
  createClients,
  vaultsFyi,
  executeActions,
  resolveNetwork,
} from "./shared";

const networkArg = process.argv[2];

if (!networkArg) {
  console.error("Usage: pnpm claim-rewards <network>");
  process.exit(1);
}

async function main() {
  const { network, chain } = resolveNetwork(networkArg!);
  const { walletClient, publicClient, userAddress } = await createClients(chain);

  const rewardsContext = await vaultsFyi.getRewardsTransactionsContext({
    path: { userAddress },
  });

  const rewards = rewardsContext.claimable[network] ?? [];

  if (rewards.length === 0) {
    console.log(`No claimable rewards on ${network}.`);
    process.exit(0);
  }

  for (const r of rewards) {
    console.log(
      `Claimable: ${r.asset.claimableAmount} ${r.asset.symbol} (${r.asset.claimableAmountInUsd ?? "?"} USD)`,
    );
  }

  const claimIds = rewards.map((r) => r.claimId);

  const claim = await vaultsFyi.getRewardsClaimActions({
    path: { userAddress },
    query: { claimIds },
  });

  await executeActions(
    walletClient,
    publicClient,
    claim[network].actions,
    claim[network].currentActionIndex,
  );

  console.log("Rewards claimed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
