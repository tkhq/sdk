import { createClients, vaultsFyi, resolveNetwork } from "./shared";

const networkArg = process.argv[2];

if (!networkArg) {
  console.error("Usage: pnpm discover <network>");
  process.exit(1);
}

async function main() {
  const { network, chain } = resolveNetwork(networkArg!);
  const { userAddress } = await createClients(chain);
  console.log("Wallet address:", userAddress);

  const recommendations = await vaultsFyi.getDepositOptions({
    path: { userAddress },
    query: {
      allowedNetworks: [network],
      onlyTransactional: true,
      minUsdAssetValueThreshold: 0.1,
    },
  });

  for (const balance of recommendations.userBalances) {
    console.log(`\nAsset: ${balance.asset?.symbol ?? "unknown"}`);
    for (const opt of balance.depositOptions) {
      console.log(
        `  ${opt.name} (${opt.protocol.name}) – ${(opt.apy.total * 100).toFixed(2)}% APY – vaultId: ${opt.vaultId}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
