import type { v1EarnVault } from "@turnkey/sdk-server";

import {
  ASSET_CAIP19,
  C,
  CATALOG_AVAILABLE,
  CHAIN_CAIP2,
  chainName,
  EARN_PROVIDER,
  header,
  newClient,
  PARENT_TAG,
  pct,
  usd,
  vaultNamesOnChain,
} from "./common";

// Step 1: discover the wrappable vault catalog, marking already-enabled vaults.
// Vault name/curator come from the catalog API when available, with an
// on-chain ERC-20 name() fallback on EVM. On Solana each entry is a Kamino
// K-Lend reserve; `vaultAddress` is the reserve address.
async function main() {
  const { client, organizationId } = newClient("PARENT");

  header("Discover available vaults", PARENT_TAG);

  if (!CATALOG_AVAILABLE) {
    console.log(
      `Kamino's catalog API covers Solana mainnet only, so list_earn_vaults is empty on ${CHAIN_CAIP2}.\n` +
        `Set VAULT_ADDRESS to the K-Lend reserve to enable and run \`pnpm deploy-vault\`.`,
    );
    return;
  }

  const { vaults = [] } = await client.earnVaults({
    organizationId,
    caip19: ASSET_CAIP19,
    provider: EARN_PROVIDER,
  });

  const top = vaults.slice(0, 5);

  const fallbackNames = top.some((v: v1EarnVault) => !v.name)
    ? await vaultNamesOnChain(top.map((v: v1EarnVault) => v.vaultAddress))
    : [];

  console.log(
    `🏦 Vault catalog on ${chainName(ASSET_CAIP19)} for ${ASSET_CAIP19} (top ${top.length} by TVL):`,
  );
  for (const [i, v] of top.entries()) {
    const tvl = v.display?.usd
      ? `$${Number(v.display.usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : usd(v.tvl);
    const enabled = v.enabled ? `  ${C.green}✓ enabled${C.reset}` : "";
    const name = v.name ?? fallbackNames[i] ?? "?";
    const curator = v.curator
      ? `  ${C.dim}curated by ${v.curator}${C.reset}`
      : "";

    console.log(`   ${C.bold}${name}${C.reset}${curator}${enabled}`);
    console.log(
      `     ${v.vaultAddress}  ${chainName(v.caip19)}  APY ${pct(v.apyPct)}  TVL ${tvl}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
