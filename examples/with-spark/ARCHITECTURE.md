# Architecture

How the pieces of `with-spark` fit together. Read this after you've run a script
from the README and want to understand *why* it works.

## Layers

```
┌────────────────────────────────────────────────────────────┐
│  Entry-point scripts            transfer.ts, claim.ts,     │
│  (top of src/)                  withdraw.ts, lightning-*,  │
│                                 e2e-*, setup*, init.ts     │
├────────────────────────────────────────────────────────────┤
│  TurnkeySparkSigner             src/turnkeySigner.ts       │
│  (the public facade)            (you construct this)       │
├────────────────────────────────────────────────────────────┤
│  Integration glue               src/internal/turnkey*.ts   │
│  (Spark-SDK adapters)                                      │
├────────────────────────────────────────────────────────────┤
│  Spark protocol primitives      @buildonspark/spark-sdk    │
│                                 + src/internal/htlc-*.ts   │
│                                 (vendored)                 │
├────────────────────────────────────────────────────────────┤
│  Turnkey API                    @turnkey/sdk-server        │
└────────────────────────────────────────────────────────────┘
```

You only ever construct `TurnkeySparkSigner`. Everything below it (including
`internal/`) is implementation detail of the integration.

## File map

### `src/` — entry points and the public facade

| File                      | Role                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `turnkeySigner.ts`        | `TurnkeySparkSigner` class — the only thing you construct     |
| `spark-paths.ts`          | BIP32 path constants shared by setup scripts                  |
| `setup.ts`, `setup-e2e.ts`, `setup-l1.ts` | Wallet-creation scripts                       |
| `init.ts`                 | Constructs a `SparkWallet` wired to `TurnkeySparkSigner`      |
| `transfer.ts`, `claim.ts`, `withdraw.ts`, `token-transfer.ts` | Single-flow examples       |
| `lightning-send.ts`, `lightning-receive.ts` | Lightning examples                          |
| `e2e-regtest.ts`, `e2e-lightning-regtest.ts` | Full end-to-end harnesses                  |

### `src/internal/` — integration details

| File                  | Role                                                              |
| --------------------- | ----------------------------------------------------------------- |
| `turnkeyTransfer.ts`  | Drives `SPARK_PREPARE_TRANSFER` for outbound transfers            |
| `turnkeyClaim.ts`     | Drives `SPARK_CLAIM_TRANSFER` for inbound transfers               |
| `turnkeyWithdraw.ts`  | Coop-exit / withdraw flow                                         |
| `turnkeyLightning.ts` | Lightning send + receive flows                                    |
| `turnkeySwap.ts`      | Leaf-swap flow used by SDK leaf selection                         |
| `turnkeyInternal.ts`  | Shared helpers + the batched-FROST core (`signRefundsBatched`)    |
| `htlc-transactions.ts`| Vendored from `@buildonspark/spark-sdk@0.7.5` (see [Vendored](#vendored-code)) |

### `src/scripts/`, `src/spark-deposit/`

L1 deposit flows. Out of scope for the core integration story.

## Trust edges & load-bearing invariants

These are the things that, if they break, break everything quietly. Comment-document
them at every read site; don't assume future contributors will read this file.

1. **`leaf.verifyingPublicKey == HD(leaf_id)` after a successful claim.** The
   per-leaf FROST aggregate verifying key equals the user's HD-derived signing
   key for that `leaf_id`. We rely on this in `signRefundsBatched`
   ([`internal/turnkeyInternal.ts`](src/internal/turnkeyInternal.ts)) so
   send-flow refund signing can use `leaf.verifyingPublicKey` directly without
   a separate pubkey-derivation round-trip. If Spark ever decouples per-leaf
   aggregate VK from the user's HD share, this breaks silently.

2. **Operator recipients must be sorted by numeric ID.** The signer (Turnkey
   enclave) assigns Feldman polynomial evaluation points by *array position*,
   not by the `operatorId` field. `getOperatorRecipients()` is the single
   chokepoint that sorts; pre-sort, `Object.values()` insertion order would
   scramble share assignment and operators couldn't reconstruct. See commit
   `558d66361` for the original incident.

3. **`newLeafPublicKeys` returned by `PREPARE_/SPARK_CLAIM_TRANSFER` are
   trusted but bounded.** The SDK validates format (hex + secp256k1 point),
   uniqueness, and leafId-set-equals-input. A signer that lies with a
   syntactically valid pubkey is still bounded by FROST aggregation: operator
   shares actually sum to `HD(leaf_id)`, so a lying signer's signature simply
   fails to verify on-chain — DOS, not loss-of-funds.

## Vendored code

`src/internal/htlc-transactions.ts` is copied verbatim from
`@buildonspark/spark-sdk@0.7.5`'s `src/utils/htlc-transactions.ts`. The
`createRefundTxsForLightning` symbol is not part of the package's public
exports, so we can't import it. When spark-sdk re-exports it, delete the file
and import directly. The package version in `package.json` is pinned (no
caret) so we control upgrades.

## Where to look first

- **"How do I sign a Spark transfer with Turnkey?"** — read `transfer.ts`
  (entry point) → `internal/turnkeyTransfer.ts` (orchestration) →
  `turnkeySigner.prepareTransfer` (Turnkey activity boundary).
- **"How does FROST signing work here?"** — `signRefundsBatched` in
  `internal/turnkeyInternal.ts`; one batched `SPARK_SIGN_FROST` activity
  collapses N leaves × up to 3 directions into a single round-trip.
- **"What's the deal with the HD pubkey caching?"** — `seedLeafSigningKeys`,
  `prefetchSigningHdAccounts`, and `getLeafSigningKey` in `turnkeySigner.ts`.
- **"What changed when?"** — the load-bearing invariants section above
  cites the commits where each invariant was established.
