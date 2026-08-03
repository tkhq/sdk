import { getSuiClient, resolveAddress } from "./shared";

const SUI_COIN_TYPE = "0x2::sui::SUI";
const MIST_PER_SUI = 1_000_000_000n;
const PAGE_LIMIT = 10;

function formatSui(mist: bigint): string {
  const negative = mist < 0n;
  const abs = negative ? -mist : mist;
  const whole = abs / MIST_PER_SUI;
  const fraction = abs % MIST_PER_SUI;
  const fractionStr = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  const body = fractionStr.length > 0 ? `${whole}.${fractionStr}` : `${whole}`;
  return negative ? `-${body}` : body;
}

function formatTimestamp(ms?: string | null): string {
  if (!ms) return "unknown";
  const n = Number(ms);
  if (!Number.isFinite(n)) return ms;
  return new Date(n).toISOString();
}

/**
 * Sum SUI balance changes attributed to `owner` across a tx's balanceChanges
 * array. Returns MIST as a signed bigint (positive = inflow, negative =
 * outflow). Silently returns 0n when balance changes are absent.
 */
function suiDeltaForOwner(balanceChanges: unknown, owner: string): bigint {
  if (!Array.isArray(balanceChanges)) return 0n;
  let delta = 0n;
  for (const bc of balanceChanges) {
    if (!bc || typeof bc !== "object") continue;
    const change = bc as {
      coinType?: string;
      amount?: string;
      owner?: unknown;
    };
    if (change.coinType !== SUI_COIN_TYPE) continue;
    const ownerField = change.owner as
      | { AddressOwner?: string; ObjectOwner?: string }
      | string
      | undefined;
    const addressOwner =
      typeof ownerField === "object" && ownerField
        ? ownerField.AddressOwner
        : undefined;
    if (addressOwner !== owner) continue;
    if (!change.amount) continue;
    try {
      delta += BigInt(change.amount);
    } catch {
      // ignore non-numeric amounts
    }
  }
  return delta;
}

async function printTxList(
  label: string,
  owner: string,
  txs: Array<{
    digest: string;
    timestampMs?: string | null;
    balanceChanges?: unknown;
  }>,
) {
  console.log(`\n=== ${label} (${txs.length}) ===`);
  if (!txs.length) {
    console.log("  (none)");
    return;
  }
  for (const tx of txs) {
    const delta = suiDeltaForOwner(tx.balanceChanges, owner);
    const deltaStr =
      delta === 0n ? "delta: n/a" : `delta: ${formatSui(delta)} SUI`;
    console.log(
      `  - ${tx.digest}  ts=${formatTimestamp(tx.timestampMs)}  ${deltaStr}`,
    );
  }
}

async function main() {
  const address = resolveAddress(process.argv[2]);
  const provider = getSuiClient();

  console.log(`Address: ${address}`);
  console.log(`Fetching most recent ${PAGE_LIMIT} inflows and outflows...`);

  // Node-provider reads. Two separate queries because the JSON-RPC filter
  // is either FromAddress or ToAddress, not both.
  const [outflowsResp, inflowsResp] = await Promise.all([
    provider.queryTransactionBlocks({
      filter: { FromAddress: address },
      options: { showBalanceChanges: true },
      order: "descending",
      limit: PAGE_LIMIT,
    }),
    provider.queryTransactionBlocks({
      filter: { ToAddress: address },
      options: { showBalanceChanges: true },
      order: "descending",
      limit: PAGE_LIMIT,
    }),
  ]);

  await printTxList("Outflows (FromAddress)", address, outflowsResp.data);
  await printTxList("Inflows  (ToAddress)", address, inflowsResp.data);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
