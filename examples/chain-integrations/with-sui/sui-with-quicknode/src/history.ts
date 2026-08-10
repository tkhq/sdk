import {
  GrpcTypes,
  parseGrpcTransactionResponse,
  SuiGrpcClient,
} from "@mysten/sui/grpc";
import { getSuiClient, resolveAddress } from "./shared.js";

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
 *
 * The gRPC `BalanceChange` shape is flat: `{ coinType, address, amount }`
 * (unlike the deprecated JSON-RPC shape that nested owner as
 * `{ AddressOwner: '0x...' }`).
 */
function suiDeltaForOwner(
  balanceChanges:
    | ReadonlyArray<{ coinType?: string; address?: string; amount?: string }>
    | undefined,
  owner: string,
): bigint {
  if (!balanceChanges || !balanceChanges.length) return 0n;
  let delta = 0n;
  for (const change of balanceChanges) {
    if (change.coinType !== SUI_COIN_TYPE) continue;
    if (change.address !== owner) continue;
    if (!change.amount) continue;
    try {
      delta += BigInt(change.amount);
    } catch {
      // ignore non-numeric amounts
    }
  }
  return delta;
}

interface HistoryEntry {
  digest: string;
  timestampMs: string | null;
  delta: bigint;
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
 * the balance-change delta as the criterion.
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
      // Descending order to get the most recent transactions first, and
      // request one extra so we know whether more pages exist.
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
      delta: suiDeltaForOwner(inner.balanceChanges, owner),
    });
  }
  return entries;
}

function printTxList(label: string, entries: HistoryEntry[]): void {
  console.log(`\n=== ${label} (${entries.length}) ===`);
  if (!entries.length) {
    console.log("  (none)");
    return;
  }
  for (const entry of entries) {
    const deltaStr =
      entry.delta === 0n
        ? "delta: n/a"
        : `delta: ${formatSui(entry.delta)} SUI`;
    console.log(
      `  - ${entry.digest}  ts=${formatTimestamp(entry.timestampMs)}  ${deltaStr}`,
    );
  }
}

async function main() {
  const address = resolveAddress(process.argv[2]);
  const provider = getSuiClient();

  console.log(`Address: ${address}`);
  console.log(
    `Fetching most recent ${PAGE_LIMIT * 2} transactions affecting this address...`,
  );

  // Single gRPC query, classified locally into inflows vs outflows by
  // balance-change delta. We over-fetch to make each side more likely to
  // fill up to PAGE_LIMIT even in noisy address histories.
  const entries = await listAffectingTransactions(
    provider,
    address,
    PAGE_LIMIT * 2,
  );

  const inflows = entries.filter((e) => e.delta > 0n).slice(0, PAGE_LIMIT);
  const outflows = entries.filter((e) => e.delta < 0n).slice(0, PAGE_LIMIT);

  printTxList("Outflows (delta < 0)", outflows);
  printTxList("Inflows  (delta > 0)", inflows);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
