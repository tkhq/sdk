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

  const { caip2 } = await prompts({
    type: "text",
    name: "caip2",
    message: "Network (CAIP-2):",
    initial: "eip155:1",
  });

  if (!caip2) {
    console.log("Cancelled.");
    return;
  }

  const turnkey = getTurnkeyClient();
  const { assets } = await turnkey.apiClient().listSupportedAssets({
    organizationId,
    caip2,
  });

  if (!assets?.length) {
    console.log(`\nNo supported assets found for ${caip2}`);
    return;
  }

  console.log(`\nSupported assets on ${caip2}:\n`);

  const rows = assets.map((asset: (typeof assets)[number]) => ({
    Symbol: asset.symbol ?? "Unknown",
    "CAIP-19": asset.caip19 ?? "-",
    Logo: asset.logoUrl ?? "-",
    Decimals: asset.decimals ?? "-",
  }));

  console.table(rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
