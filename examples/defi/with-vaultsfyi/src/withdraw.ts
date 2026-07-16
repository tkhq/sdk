import {
  createClients,
  vaultsFyi,
  executeActions,
  resolveNetwork,
  getAssetAddress,
} from "./shared";

const [networkArg, vaultId] = process.argv.slice(2);

if (!networkArg || !vaultId) {
  console.error("Usage: pnpm withdraw <network> <vaultId>");
  process.exit(1);
}

async function main() {
  const { network, chain } = resolveNetwork(networkArg!);
  const { walletClient, publicClient, userAddress } =
    await createClients(chain);

  const assetAddress = await getAssetAddress(network, vaultId!);

  const { currentActionIndex, actions } = await vaultsFyi.getActions({
    path: {
      action: "redeem",
      userAddress,
      network,
      vaultId: vaultId!,
    },
    query: {
      assetAddress,
      all: true,
    },
  });

  console.log(
    `${actions.length} steps, starting at index ${currentActionIndex}`,
  );

  await executeActions(walletClient, publicClient, actions, currentActionIndex);

  console.log("Withdraw complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
