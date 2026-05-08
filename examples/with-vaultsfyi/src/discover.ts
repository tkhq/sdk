/**
 * Lists the top vaults vaults.fyi recommends for the user's existing wallet
 * balances. One call returns ranked options across every supported protocol,
 * filtered by the assets the user actually holds.
 *
 * Run with: pnpm discover
 */

import { VaultsSdk } from "@vaultsfyi/sdk";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const vaultsFyi = new VaultsSdk({ apiKey: process.env.VAULTS_FYI_API_KEY! });
  const userAddress = process.env.SIGN_WITH!;

  const recommendations = await vaultsFyi.getDepositOptions({
    path: { userAddress },
    query: {
      allowedAssets: ["USDC"],
      allowedNetworks: ["base"],
      onlyTransactional: true,
    },
  });

  if (recommendations.userBalances.length === 0) {
    console.log(`No qualifying balances for ${userAddress} on base.`);
    return;
  }

  for (const bucket of recommendations.userBalances) {
    if (bucket.asset) {
      console.log(
        `\n${bucket.asset.symbol} balance: ${bucket.asset.balanceNative ?? "?"}`,
      );
    }
    for (const option of bucket.depositOptions.slice(0, 5)) {
      const apyPct = (option.apy.total * 100).toFixed(2);
      console.log(`  - ${option.protocol.name} | ${option.name} | ${apyPct}% APY`);
      console.log(`      vaultId: ${option.vaultId}`);
      console.log(`      address: ${option.address}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
