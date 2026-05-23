import {
  createClients,
  vaultsFyi,
  executeActions,
  resolveNetwork,
  getAssetAddress,
} from "./shared";

const [networkArg, vaultId, amount] = process.argv.slice(2);

if (!networkArg || !vaultId || !amount) {
  console.error("Usage: pnpm deposit <network> <vaultId> <amount>");
  process.exit(1);
}

async function main() {
  const { network, chain } = resolveNetwork(networkArg!);
  const { walletClient, publicClient, userAddress } = await createClients(chain);

  const assetAddress = await getAssetAddress(network, vaultId!);

  const { currentActionIndex, actions } = await vaultsFyi.getActions({
    path: {
      action: "deposit",
      userAddress,
      network,
      vaultId: vaultId!,
    },
    query: {
      assetAddress,
      amount: amount!,
    },
  });

  console.log(
    `${actions.length} steps, starting at index ${currentActionIndex}`,
  );

  await executeActions(walletClient, publicClient, actions, currentActionIndex);

  console.log("Deposit complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
