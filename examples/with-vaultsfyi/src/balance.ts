/**
 * Lists every vault position the user holds across every supported network and
 * protocol. vaults.fyi reads on-chain state directly, so positions opened
 * outside this app (e.g. through MetaMask, Phantom, or any other wallet) are
 * included.
 *
 * Run with: pnpm balance
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { VaultsSdk } from "@vaultsfyi/sdk";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const vaultsFyi = new VaultsSdk({ apiKey: process.env.VAULTS_FYI_API_KEY! });
  const userAddress = process.env.SIGN_WITH!;

  const { data: positions } = await vaultsFyi.getPositions({
    path: { userAddress },
  });

  if (positions.length === 0) {
    console.log(`No vault positions found for ${userAddress}.`);
    return;
  }

  console.log(`Positions for ${userAddress}:\n`);
  for (const p of positions) {
    const apyPct = (p.apy.total * 100).toFixed(2);
    const balance =
      p.asset.balanceUsd ??
      `${p.asset.balanceNative ?? "?"} ${p.asset.symbol}`;
    console.log(`  ${p.protocol.name} / ${p.name} (${p.network.name})`);
    console.log(
      `    balance: ${balance}${p.asset.balanceUsd ? " USD" : ""}`,
    );
    console.log(`    APY: ${apyPct}%`);
    if (p.asset.unclaimedUsd) {
      console.log(`    unclaimed rewards: ${p.asset.unclaimedUsd} USD`);
    }
    console.log(`    vaultId: ${p.vaultId}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
