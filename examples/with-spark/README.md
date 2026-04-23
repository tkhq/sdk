# Example: `with-spark`

Demonstrates [Spark](https://spark.money) operations using **Turnkey as the key custodian**. Private keys never leave Turnkey's enclave — all signing happens via Turnkey activities.

## Operations

| Script | What it does | Turnkey activity |
|--------|-------------|-----------------|
| `pnpm run token-transfer` | Create, mint, and transfer a Spark token | `SignRawPayload` (ECDSA) |
| `pnpm run deposit` | Fund a Spark wallet from Bitcoin L1 | `SPARK_PREPARE_AND_SIGN` (FROST) |
| `pnpm run transfer` | Send sats to another Spark address | `SPARK_PREPARE_AND_SIGN` (FROST + key tweaks) |
| `pnpm run claim` | Receive an inbound Spark transfer | `SPARK_PREPARE_AND_SIGN` (verify + decrypt + key tweaks) |
| `pnpm run withdraw` | Cooperative exit back to Bitcoin L1 | `SPARK_PREPARE_AND_SIGN` (FROST + key tweaks) |

## Getting started

### 1. Clone & install

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install -r
pnpm run build-all
cd examples/with-spark/
```

### 2. Create a Spark wallet

```bash
pnpm run setup
```

This creates a Turnkey wallet with the Spark IDENTITY account and prints the env vars you need.

### 3. Configure `.env.local`

```bash
# Turnkey credentials
API_PUBLIC_KEY=...
API_PRIVATE_KEY=...
ORGANIZATION_ID=...
BASE_URL=https://api.turnkey.com   # optional, this is the default

# From `pnpm run setup` output
TURNKEY_SPARK_ADDRESS=...
IDENTITY_PUBLIC_KEY_HEX=...

# For transfer / token-transfer
RECEIVER_SPARK_ADDRESS=...

# For withdraw
WITHDRAW_BTC_ADDRESS=...

# For deposit (regtest only)
BITCOIN_RPC_URL=http://127.0.0.1:18443
BITCOIN_RPC_USER=user
BITCOIN_RPC_PASS=pass

# Optional
SPARK_NETWORK=REGTEST              # or MAINNET
DEPOSIT_AMOUNT_SATS=100000
TRANSFER_AMOUNT_SATS=50000
WITHDRAW_AMOUNT_SATS=25000
```

### 4. Run

```bash
# Token operations (no Bitcoin needed)
pnpm run token-transfer

# Bitcoin L2 operations (requires regtest for deposit)
pnpm run deposit
pnpm run transfer
pnpm run claim
pnpm run withdraw
```

## Architecture

The `TurnkeySparkSigner` implements the Spark SDK's `SparkSigner` interface, routing all cryptographic operations to Turnkey:

- **ECDSA signing** — `SignRawPayload` (identity key authentication, token operations)
- **FROST signing** — `SPARK_PREPARE_AND_SIGN` (threshold Schnorr for Bitcoin transactions)
- **Key derivation** — `SPARK_KEY_OPERATION` (derive deposit/signing public keys)
- **Transfer/claim orchestration** — `SPARK_PREPARE_AND_SIGN` with package requests (key tweaks + encrypted operator packages, all inside the enclave)

Custom orchestration (`turnkeyTransfer.ts`, `turnkeyClaim.ts`, `turnkeyWithdraw.ts`) replaces the SDK's built-in transfer/claim flows because the SDK calls `subtractSplitAndEncrypt()` per-leaf, exposing raw Feldman shares client-side. Turnkey's enclave does this atomically — raw shares never leave the enclave boundary.
