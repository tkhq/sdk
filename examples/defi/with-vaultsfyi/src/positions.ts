import { createClients, vaultsFyi, resolveNetwork } from "./shared";

const networkArg = process.argv[2];

if (!networkArg) {
  console.error("Usage: pnpm positions <network>");
  process.exit(1);
}

async function main() {
  const { chain } = resolveNetwork(networkArg!);
  const { userAddress } = await createClients(chain);

  const { data: positions } = await vaultsFyi.getPositions({
    path: { userAddress },
  });

  if (positions.length === 0) {
    console.log("No positions found.");
  } else {
    for (const p of positions) {
      console.log(
        `${p.protocol.name} ${p.name} on ${p.network.name}: \n` +
          `${p.lpToken?.balanceUsd ?? "?"} USD, ${(p.apy.total * 100).toFixed(2)}% APY \n` +
          `(vault address: ${p.vaultId})`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
