import { Transaction } from "@mysten/sui/transactions";
import { messageWithIntent } from "@mysten/sui/cryptography";
import { blake2b } from "@noble/hashes/blake2b";
import { bytesToHex } from "@noble/hashes/utils";

import {
  formatUnits,
  getSuiClient,
  getTurnkeyClient,
  loadSignerPublicKey,
  toSerializedSignature,
} from "./shared.js";

/**
 * Coin object returned by `SuiGrpcClient.listCoins`. Redefined locally
 * (structural) so we don't leak the SDK's `Coin` type into helpers.
 */
interface CoinObject {
  objectId: string;
  version: string;
  digest: string;
  balance: string;
}

/**
 * Pick a set of SUI coin objects for gas payment.
 *
 * Sui allows an array of gas coins per transaction — the first is treated
 * as the primary and any additional coins are merged into it during
 * execution. This lets us cover `required = gasBudget + amount` without
 * an explicit `mergeCoins` PTB command when no single coin object is
 * large enough on its own.
 *
 * Selection strategy:
 *   1. If any single coin covers `required`, use just that one (cheapest).
 *   2. Otherwise, greedily add the largest coins until the sum covers
 *      `required` and return that set.
 *   3. If the total across all coin objects is still short, throw with a
 *      descriptive error listing every coin balance and the shortfall.
 *
 * This addresses Vincent's Round 2 feedback that `coins.objects[0]!` was
 * unsafe: the first coin object might not cover gas + amount, in which
 * case broadcast would fail with a cryptic InsufficientGas error.
 */
function selectGasCoins(coins: CoinObject[], required: bigint): CoinObject[] {
  if (!coins.length) {
    throw new Error(
      "No SUI coin objects available for gas payment. Fund the address before running this example.",
    );
  }

  // Fast path: pick the smallest single coin that covers `required` so we
  // don't unnecessarily lock up a big coin. Falls back to the largest coin
  // when nothing covers on its own.
  //
  // Equivocation risk (demo-only trade-off): this selection is deterministic,
  // so two concurrent sends from the same address will pick the same coin
  // object and lock it until epoch end. Fine for a single-shot demo. For
  // production or any concurrent sender, randomize the pick or use an
  // explicit coin-locking / coordination mechanism so parallel transactions
  // don't race on the same input.
  const sortedAsc = [...coins].sort((a, b) => {
    const av = BigInt(a.balance);
    const bv = BigInt(b.balance);
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  const singleCover = sortedAsc.find((c) => BigInt(c.balance) >= required);
  if (singleCover) return [singleCover];

  // Multi-coin path: sum from largest to smallest, using the array-of-gas
  // form to merge them at execution time.
  const sortedDesc = [...coins].sort((a, b) => {
    const av = BigInt(a.balance);
    const bv = BigInt(b.balance);
    return av > bv ? -1 : av < bv ? 1 : 0;
  });
  const picked: CoinObject[] = [];
  let sum = 0n;
  for (const coin of sortedDesc) {
    picked.push(coin);
    sum += BigInt(coin.balance);
    if (sum >= required) return picked;
  }

  // Still short — total balance across all coin objects can't cover gas +
  // amount. Fail loud with the exact shortfall and per-coin balances.
  const total = sortedDesc.reduce((acc, c) => acc + BigInt(c.balance), 0n);
  const shortfall = required - total;
  const perCoin = sortedDesc
    .map((c) => `    ${c.objectId} = ${c.balance} MIST`)
    .join("\n");
  throw new Error(
    `Insufficient SUI to cover gas + amount.\n` +
      `  Required: ${required.toString()} MIST (${formatUnits(required, 9)} SUI)\n` +
      `  Total available: ${total.toString()} MIST (${formatUnits(total, 9)} SUI)\n` +
      `  Shortfall: ${shortfall.toString()} MIST (${formatUnits(shortfall, 9)} SUI)\n` +
      `  Coins:\n${perCoin}`,
  );
}

async function main() {
  const { address, publicKey } = loadSignerPublicKey();

  // Self-transfer for demo purposes so the example is safe to re-run.
  const recipient = address;
  const amount = 1_000_000n; // 0.001 SUI
  const gasBudget = 5_000_000n;

  const turnkeyClient = getTurnkeyClient();
  const provider = getSuiClient();

  // *** TRANSACTION BUILDING *** //

  // Fetch the user's SUI coin objects via the gRPC node provider.
  // `listCoins` returns `{ objects: Coin[], hasNextPage, cursor }` where
  // each `Coin` is `{ objectId, version, digest, owner, type, balance }`.
  //
  // Page through until we have every coin (or the paginator hits the
  // node's page cap). We need the full set so `selectGasCoins` can pick
  // one that actually covers gasBudget + amount, and can merge multiple
  // when no single object is large enough.
  const suiCoins: CoinObject[] = [];
  let cursor: string | null = null;
  do {
    const page = await provider.listCoins({
      owner: address,
      coinType: "0x2::sui::SUI",
      cursor,
    });
    for (const c of page.objects) {
      suiCoins.push({
        objectId: c.objectId,
        version: c.version,
        digest: c.digest,
        balance: c.balance,
      });
    }
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);

  // Pick coin(s) that cover `gasBudget + amount`. For a SUI send, the
  // send amount comes out of the same coin(s) we're using for gas — see
  // the `tx.splitCoins(tx.gas, ...)` call below. Throws with a
  // descriptive error (per-coin balances + shortfall) if nothing works.
  const required = gasBudget + amount;
  const gasCoins = selectGasCoins(suiCoins, required);

  const tx = new Transaction();
  tx.setSender(address);
  const { referenceGasPrice } = await provider.getReferenceGasPrice();
  tx.setGasPrice(referenceGasPrice);
  tx.setGasBudget(gasBudget);
  // When more than one gas coin is supplied, Sui merges them into the
  // first at execution time, so we can transparently cover gas + amount
  // even when no single coin object is large enough.
  tx.setGasPayment(
    gasCoins.map((c) => ({
      objectId: c.objectId,
      version: c.version,
      digest: c.digest,
    })),
  );
  const coin = tx.splitCoins(tx.gas, [tx.pure("u64", amount)]);
  tx.transferObjects([coin], tx.pure.address(recipient));

  const txBytes = await tx.build();

  // Canonical Turnkey-Sui signing flow (unchanged): wrap tx bytes in the
  // "TransactionData" intent, blake2b(32) it, then have Turnkey sign the
  // raw 32-byte digest.
  const intentMsg = messageWithIntent("TransactionData", txBytes);
  const digest = blake2b(intentMsg, { dkLen: 32 });

  const { r, s } = await turnkeyClient.apiClient().signRawPayload({
    signWith: address,
    payload: bytesToHex(digest),
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
  });

  const signature = Buffer.from(r + s, "hex");
  const serialized = toSerializedSignature({ signature, pubKey: publicKey });

  // *** EXECUTION *** //

  // Broadcast through the gRPC node provider. Quicknode by default when
  // QUICKNODE_SUI_URL is set, otherwise the public testnet gRPC fullnode.
  // The gRPC `executeTransaction` takes raw transaction bytes plus an
  // array of base64-encoded flagged signatures.
  const result = await provider.executeTransaction({
    transaction: txBytes,
    signatures: [serialized],
  });

  const executed =
    result.$kind === "Transaction"
      ? result.Transaction
      : result.FailedTransaction;
  console.log("Transaction digest:", executed.digest);
  if (result.$kind === "FailedTransaction") {
    console.error("Transaction failed:", executed.status.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
