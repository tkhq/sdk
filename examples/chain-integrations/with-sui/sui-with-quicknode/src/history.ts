import {
  GrpcTypes,
  parseGrpcTransactionResponse,
  SuiGrpcClient,
} from "@mysten/sui/grpc";
import { normalizeStructTag } from "@mysten/sui/utils";
import {
  createCoinMetaResolver,
  formatUnits,
  getSuiClient,
  resolveAddress,
} from "./shared.js";

const PAGE_LIMIT = 10;

function formatTimestamp(ms?: string | null): string {
  if (!ms) return "unknown";
  const n = Number(ms);
  if (!Number.isFinite(n)) return ms;
  return new Date(n).toISOString();
}

/**
 * Sum per-coin-type balance changes attributed to `owner` across a tx's
 * balanceChanges array. Returns a Map keyed by normalized (fully-qualified)
 * coin type, with signed bigint deltas in base units (positive = inflow,
 * negative = outflow). Silently returns an empty map when balance changes
 * are absent.
 *
 * Vincent's Round 2 feedback: a tx that pays SUI gas but receives USDC
 * would previously classify as pure Outflow, because the old
 * implementation only summed the SUI delta. We now surface every coin the
 * owner touched so mixed-coin txs are classified correctly and the UI can
 * print per-coin deltas.
 *
 * The gRPC `BalanceChange` shape is flat: `{ coinType, address, amount }`
 * (unlike the deprecated JSON-RPC shape that nested owner as
 * `{ AddressOwner: '0x...' }`). Coin types come back fully-qualified
 * (e.g. `0x000…002::sui::SUI`), so we normalize both sides for the
 * per-coin comparison to survive short-form vs long-form differences.
 */
function deltasForOwner(
  balanceChanges:
    | ReadonlyArray<{ coinType?: string; address?: string; amount?: string }>
    | undefined,
  owner: string,
): Map<string, bigint> {
  const deltas = new Map<string, bigint>();
  if (!balanceChanges || !balanceChanges.length) return deltas;
  for (const change of balanceChanges) {
    if (!change.coinType || !change.amount) continue;
    if (change.address !== owner) continue;
    let amount: bigint;
    try {
      amount = BigInt(change.amount);
    } catch {
      continue;
    }
    if (amount === 0n) continue;
    const key = normalizeStructTag(change.coinType);
    deltas.set(key, (deltas.get(key) ?? 0n) + amount);
  }
  return deltas;
}

interface HistoryEntry {
  digest: string;
  timestampMs: string | null;
  /** Per-coin-type signed deltas in base units. */
  deltas: Map<string, bigint>;
}

/**
 * Convert a proto Timestamp (`{ seconds: bigint, nanos: number }`) into
 * milliseconds as a decimal string, matching the JSON-RPC `timestampMs`
 * format the previous implementation printed.
 */
function timestampToMs(timestamp?: {
  seconds?: bigint | string | number;
  nanos?: number;
}): string | null {
  if (!timestamp || timestamp.seconds === undefined) return null;
  const seconds = BigInt(timestamp.seconds as bigint | string | number);
  const nanos = BigInt(timestamp.nanos ?? 0);
  const ms = seconds * 1000n + nanos / 1_000_000n;
  return ms.toString();
}

/**
 * True if the tx has any positive delta on any coin type (inflow).
 */
function hasInflow(entry: HistoryEntry): boolean {
  for (const delta of entry.deltas.values()) if (delta > 0n) return true;
  return false;
}

/**
 * True if the tx has any negative delta on any coin type (outflow).
 */
function hasOutflow(entry: HistoryEntry): boolean {
  for (const delta of entry.deltas.values()) if (delta < 0n) return true;
  return false;
}

/**
 * List transactions affecting `owner` via the gRPC `LedgerService.
 * ListTransactions` RPC with an `affectedAddress` filter.
 *
 * The unified `SuiGrpcClient.listTransactions` helper only exposes
 * `sender` / `moveCall` filters (see `@mysten/sui/dist/grpc/filters.mjs`),
 * so we drive the raw `ledgerService` streaming client directly to gain
 * access to the richer proto filter surface (`affected_address`,
 * `affected_object`, etc.). We still delegate the response parsing to the
 * SDK's `parseGrpcTransactionResponse` so the friendly `balanceChanges`
 * shape (`{ coinType, address, amount }`) matches the rest of the code.
 *
 * Migration note: the deprecated JSON-RPC `queryTransactionBlocks`
 * accepted `{ FromAddress }` and `{ ToAddress }` filters, which do not
 * exist on gRPC. We now do ONE query with `affectedAddress` (matches any
 * transaction that touched the address as sender, recipient, or object
 * owner) and split the results into inflows vs outflows locally, using
 * per-coin balance-change deltas as the criterion.
 */
async function listAffectingTransactions(
  provider: SuiGrpcClient,
  owner: string,
  pageLimit: number,
): Promise<HistoryEntry[]> {
  // Raw proto filter. Structure documented in
  // `@mysten/sui/dist/grpc/proto/sui/rpc/v2/filter.d.mts` (TransactionFilter
  // -> TransactionTerm -> TransactionLiteral).
  const filter: GrpcTypes.TransactionFilter = {
    terms: [
      {
        literals: [
          {
            negated: false,
            predicate: {
              oneofKind: "affectedAddress",
              affectedAddress: { address: owner },
            },
          },
        ],
      },
    ],
  };

  const call = provider.ledgerService.listTransactions({
    // Field mask: pull digest, timestamp, and balance_changes only. The
    // SDK's own helper adds `signatures` and `effects.status`; we include
    // those too so `parseGrpcTransactionResponse` yields a usable
    // `TransactionResult`.
    readMask: {
      paths: [
        "digest",
        "signatures",
        "effects.status",
        "timestamp",
        "balance_changes",
      ],
    },
    filter,
    options: {
      // Descending order so we get the most recent transactions first.
      // This is a single bounded fetch of up to `pageLimit` items — the
      // demo does not paginate. A caller that wants pagination would keep
      // the last `watermark.cursor` from the stream and pass it as
      // `options.before` on the next request (or `options.after` for
      // ascending); the terminal frame's `end.reason` (a `QueryEndReason`)
      // reports whether more items may exist beyond the returned window.
      ordering: 1 /* DESCENDING */,
      limit: pageLimit,
    },
  });

  const entries: HistoryEntry[] = [];
  for await (const frame of call.responses) {
    const executed = frame.transaction;
    if (!executed) continue;
    if (entries.length >= pageLimit) break;

    // The SDK helper handles digest, status, and balance-changes mapping.
    // We reach into the raw proto for the timestamp (not surfaced on the
    // friendly Transaction type).
    const parsed = parseGrpcTransactionResponse(executed, {
      include: { balanceChanges: true },
    });
    const inner =
      parsed.$kind === "Transaction"
        ? parsed.Transaction
        : parsed.FailedTransaction;

    entries.push({
      digest: inner.digest,
      timestampMs: timestampToMs(executed.timestamp),
      deltas: deltasForOwner(inner.balanceChanges, owner),
    });
  }
  return entries;
}

/**
 * Print a labeled list of transactions with per-coin deltas, filtered to
 * only show the deltas that match this list's direction (inflows show
 * positive deltas, outflows show negative deltas).
 */
async function printTxList(
  label: string,
  entries: HistoryEntry[],
  direction: "inflow" | "outflow",
  resolveMeta: (
    coinType: string,
  ) => Promise<{ symbol: string; decimals: number }>,
): Promise<void> {
  console.log(`\n=== ${label} (${entries.length}) ===`);
  if (!entries.length) {
    console.log("  (none)");
    return;
  }
  for (const entry of entries) {
    const relevant = [...entry.deltas.entries()].filter(([, delta]) =>
      direction === "inflow" ? delta > 0n : delta < 0n,
    );
    // Resolve metadata for every coin type touched by this entry so we
    // print with the right decimals + symbol.
    const parts: string[] = [];
    for (const [coinType, delta] of relevant) {
      const { symbol, decimals } = await resolveMeta(coinType);
      parts.push(`${formatUnits(delta, decimals)} ${symbol}`);
    }
    const deltasStr = parts.length ? parts.join(", ") : "n/a";
    console.log(
      `  - ${entry.digest}  ts=${formatTimestamp(entry.timestampMs)}  ${deltasStr}`,
    );
  }
}

async function main() {
  const address = resolveAddress(process.argv[2]);
  const provider = getSuiClient();
  const resolveMeta = createCoinMetaResolver(provider);

  console.log(`Address: ${address}`);
  console.log(
    `Fetching most recent ${PAGE_LIMIT * 2} transactions affecting this address...`,
  );

  // Single gRPC query, classified locally into inflows vs outflows by
  // per-coin balance-change deltas. We over-fetch to make each side more
  // likely to fill up to PAGE_LIMIT even in noisy address histories, and
  // classification is "any positive delta" / "any negative delta" so a
  // single tx can appear in both lists (e.g. a swap: SUI out, USDC in).
  const entries = await listAffectingTransactions(
    provider,
    address,
    PAGE_LIMIT * 2,
  );

  const inflows = entries.filter(hasInflow).slice(0, PAGE_LIMIT);
  const outflows = entries.filter(hasOutflow).slice(0, PAGE_LIMIT);

  await printTxList("Outflows", outflows, "outflow", resolveMeta);
  await printTxList("Inflows", inflows, "inflow", resolveMeta);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
