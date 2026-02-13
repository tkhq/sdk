import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import prompts from "prompts";
import { getTurnkeyClient } from "./turnkey";

async function main() {
  const organizationId = process.env.ORGANIZATION_ID;

  if (!organizationId) {
    throw new Error("Missing ORGANIZATION_ID");
  }

  const { address, caip2 } = await prompts([
    {
      type: "text",
      name: "address",
      message: "Wallet address:",
    },
    {
      type: "text",
      name: "caip2",
      message: "Network (CAIP-2):",
      initial: "eip155:1",
    },
  ]);

  if (!address || !caip2) {
    console.log("Cancelled.");
    return;
  }

  const turnkey = getTurnkeyClient();
  const { balances } = await turnkey.apiClient().getWalletAddressBalances({
    organizationId,
    address,
    caip2,
  });

  if (!balances?.length) {
    console.log(`\nNo balances found for ${address} on ${caip2}`);
    return;
  }

  console.log(`\nBalances for ${address} on ${caip2}:\n`);

  const rows = balances.map((asset: (typeof balances)[number]) => ({
    Asset: asset.symbol ?? "Unknown",
    Balance: asset.display?.crypto ?? asset.balance ?? "0",
    USD: asset.display?.usd ? `$${asset.display.usd}` : "-",
  }));

  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
