import { normalizeStructTag } from "@mysten/sui/utils";
import {
  NORMALIZED_SUI_COIN_TYPE,
  createCoinMetaResolver,
  formatUnits,
  getSuiClient,
  resolveAddress,
  shortCoinType,
} from "./shared.js";

async function main() {
  // Address from CLI arg or SUI_ADDRESS env var.
  const address = resolveAddress(process.argv[2]);
  const provider = getSuiClient();
  const resolveMeta = createCoinMetaResolver(provider);

  console.log(`Address: ${address}`);

  // Node-provider read: `provider.listBalances` calls the gRPC
  // `LedgerService.ListBalances` and returns one entry per coin type the
  // address holds. Each entry:
  //   { coinType, balance, coinBalance, addressBalance }
  // where `balance` is total (coin objects + address-scoped balance),
  // `coinBalance` is the coin-object portion, and `addressBalance` is
  // the accumulator-tracked portion.
  //
  // Vincent's Round 2 feedback: the previous SUI-only + hardcoded-9-decimals
  // implementation misreported native USDC/USDT holdings (both 6 decimals)
  // and hid all non-SUI balances entirely.
  const balances: Awaited<
    ReturnType<typeof provider.listBalances>
  >["balances"] = [];
  let cursor: string | null = null;
  do {
    const page = await provider.listBalances({
      owner: address,
      cursor,
    });
    balances.push(...page.balances);
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);

  if (!balances.length) {
    console.log("(no balances)");
    return;
  }

  // Keep SUI at the top of the output for continuity with the previous
  // version of this example, then sort the rest by normalized coin type.
  const sorted = [...balances].sort((a, b) => {
    const aIsSui = normalizeStructTag(a.coinType) === NORMALIZED_SUI_COIN_TYPE;
    const bIsSui = normalizeStructTag(b.coinType) === NORMALIZED_SUI_COIN_TYPE;
    if (aIsSui && !bIsSui) return -1;
    if (bIsSui && !aIsSui) return 1;
    return normalizeStructTag(a.coinType).localeCompare(
      normalizeStructTag(b.coinType),
    );
  });

  for (const balance of sorted) {
    const { symbol, decimals } = await resolveMeta(balance.coinType);
    const total = BigInt(balance.balance);
    console.log("");
    console.log(`Coin: ${symbol}  (${shortCoinType(balance.coinType)})`);
    console.log(`  Coin balance (base units):    ${balance.coinBalance}`);
    console.log(`  Address balance (base units): ${balance.addressBalance}`);
    console.log(`  Total (base units):           ${total.toString()}`);
    console.log(
      `  Total (${symbol}):${" ".repeat(Math.max(1, 22 - symbol.length))}${formatUnits(total, decimals)}`,
    );
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
