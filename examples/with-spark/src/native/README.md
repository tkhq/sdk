# Native Spark Baseline

This folder intentionally avoids Turnkey. It uses the signer built into
`@buildonspark/spark-sdk` so faucet claim behavior can be compared against the
Turnkey-backed example.

## Setup

Generate a native Spark wallet and address:

```sh
pnpm run native:setup
```

Add the printed `NATIVE_SPARK_MNEMONIC` to `.env.local`, then send the faucet
drop to the printed Spark address.

## Claim

Claim all pending transfers:

```sh
pnpm run native:claim
```

Claim one transfer:

```sh
TRANSFER_ID=<transfer-id> pnpm run native:claim
```
