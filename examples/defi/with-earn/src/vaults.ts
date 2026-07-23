import {
  ASSET_CAIP19,
  C,
  chainName,
  header,
  newClient,
  PARENT_TAG,
  pct,
  usd,
  vaultNamesOnChain,
} from "./common";

// Step 1: discover the wrappable vault catalog, marking already-enabled vaults.
// Vault name/curator come from the catalog API when available, with an
// on-chain ERC-20 name() fallback.
async function main() {
  const { client, organizationId } = newClient("PARENT");

  header("Discover available vaults", PARENT_TAG);

  const { vaults = [] } = await client.earnVaults({
    organizationId,
    caip19: ASSET_CAIP19,
    provider: "EARN_PROVIDER_MORPHO",
  });

  const top = vaults.slice(0, 5);

  const fallbackNames = top.some((v) => !v.name)
    ? await vaultNamesOnChain(top.map((v) => v.vaultAddress))
    : [];

  console.log(
    `🏦 USDC vault catalog on ${chainName(ASSET_CAIP19)} (top ${top.length} by TVL):`,
  );
  for (const [i, v] of top.entries()) {
    const tvl = v.display?.usd
      ? `$${Number(v.display.usd).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : usd(v.tvl);
    const enabled = v.enabled ? `  ${C.green}✓ enabled${C.reset}` : "";
    const name = v.name ?? fallbackNames[i] ?? "?";
    const curator = v.curator ? `  ${C.dim}curated by ${v.curator}${C.reset}` : "";

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
