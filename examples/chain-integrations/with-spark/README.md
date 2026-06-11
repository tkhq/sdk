# Example: `with-spark`

Demonstrates [Spark](https://spark.money) operations using **Turnkey as the key custodian**. For the normal Spark flows, private keys never leave Turnkey's enclave and signing happens via Turnkey activities.

## Operations

| Script                   | What it does                                                                    | Turnkey activity                                                            |
| ------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm run setup`         | Create one Turnkey Spark wallet                                                 | `CREATE_WALLET`                                                             |
| `pnpm run hello-world`   | Smoke test: print Spark address + balance to verify the integration is wired up | (none — read-only)                                                          |
| `pnpm run claim-deposit` | Claim an existing L1 deposit                                                    | `SIGN_TRANSACTION` + `SPARK_SIGN_FROST`                                     |
| `pnpm run transfer`      | Send sats to another Spark address                                              | `SPARK_SIGN_FROST` (refund signing) + `SPARK_PREPARE_TRANSFER` (key tweaks) |
| `pnpm run withdraw`      | Cooperative exit back to Bitcoin L1                                             | `SPARK_SIGN_FROST` + `SPARK_PREPARE_TRANSFER`                               |

## Getting started

### 1. Clone & install

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install
pnpm build --filter=./examples/chain-integrations/with-spark
cd examples/chain-integrations/with-spark/
```

### 2. Configure Turnkey auth

Copy `.env.local.example` to `.env.local` and fill in the Turnkey API
credentials:

```bash
BASE_URL=https://api.turnkey.com
ORGANIZATION_ID=...
API_PUBLIC_KEY=...
API_PRIVATE_KEY=...
SPARK_NETWORK=REGTEST
```

This example is optimized for Spark hosted `REGTEST`: it uses hosted Spark
services, hosted Electrs, and the Lightspark regtest faucet. No local Bitcoin
node is required. Spark hosted `REGTEST` uses Lightspark's Bitcoin regtest
chain, not public Bitcoin testnet or signet.

Lightning receive requires the Turnkey environment you are hitting to have
the `SPARK_PREPARE_LIGHTNING_RECEIVE` activity deployed. Without it, Spark
transfer and withdrawal flows can still run, but Lightning invoice creation
will fail before payment.

### 3. Create the wallets and accounts

```bash
pnpm run setup
```

This creates Spark wallets required for the rest of the scripts.

## One-Wallet Scripts

The individual scripts are useful when testing one operation at a time.

### Create a Spark wallet

```bash
pnpm run setup
```

This creates a Turnkey wallet with the Spark IDENTITY account and prints the env vars you need.

The signer expects two Turnkey account formats for the same Spark identity
key at `m/8797555'/0'/0'`:

- `ADDRESS_FORMAT_SPARK_*` for the Spark address and BIP340/Schnorr signing.
- `ADDRESS_FORMAT_COMPRESSED` for DER ECDSA identity signatures.

In Turnkey terms, `TURNKEY_ECDSA_ADDRESS` is the compressed secp256k1 account
address for the same key as `TURNKEY_SPARK_ADDRESS`. It is also the value used
for `IDENTITY_PUBLIC_KEY_HEX`.

### Configure `.env.local`

```bash
# Turnkey credentials
API_PUBLIC_KEY=...
API_PRIVATE_KEY=...
ORGANIZATION_ID=...
BASE_URL=https://api.turnkey.com   # optional, this is the default

# From `pnpm run setup` output
TURNKEY_WALLET_ID=...
TURNKEY_SPARK_ADDRESS=...
TURNKEY_ECDSA_ADDRESS=...
IDENTITY_PUBLIC_KEY_HEX=...
```

### Run

```bash
# Bitcoin / Spark operations on hosted REGTEST
pnpm run transfer
pnpm run claim-deposit
pnpm run withdraw
```
