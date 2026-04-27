# Example: `with-spark`

Demonstrates [Spark](https://spark.money) operations using **Turnkey as the key custodian**. Private keys never leave Turnkey's enclave — all signing happens via Turnkey activities.

## Operations

| Script | What it does | Turnkey activity |
|--------|-------------|-----------------|
| `pnpm run setup:e2e` | Create sender + receiver Spark wallets and Bitcoin regtest accounts | `CREATE_WALLET` + `CREATE_WALLET_ACCOUNTS` |
| `pnpm run e2e:regtest` | Deposit BTC into Spark, transfer, claim, and withdraw back to BTC | `SIGN_TRANSACTION` + `SPARK_*` |
| `pnpm run setup` | Create one Turnkey Spark wallet | `CREATE_WALLET` |
| `pnpm run setup:l1` | Create/reuse a Turnkey Bitcoin regtest funding address | `CREATE_WALLET_ACCOUNTS` |
| `pnpm run token-transfer` | Create, mint, and transfer a Spark token | `SignRawPayload` (ECDSA) |
| `pnpm run deposit` | Fund a Spark wallet from local bitcoind regtest | `SPARK_PREPARE_AND_SIGN` (FROST) |
| `pnpm run deposit:turnkey` | Spend a Turnkey bcrt1p faucet UTXO into Spark and claim it | `SIGN_TRANSACTION` + `SPARK_PREPARE_AND_SIGN` |
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

### 3. Create the E2E wallets and accounts

```bash
pnpm run setup:e2e
```

This creates two Turnkey-owned Spark wallets and two Turnkey-owned Bitcoin
regtest Taproot accounts:

- sender Spark wallet: receives the L1 deposit and sends the Spark transfer
- sender BTC account: receives Lightspark faucet funds and funds the deposit
- receiver Spark wallet: receives and claims the Spark transfer
- receiver BTC account: receives the cooperative-exit withdrawal

Copy the printed `SENDER_*`, `RECEIVER_*`, and `WITHDRAW_BTC_ADDRESS` values
into `.env.local`.

### 4. Run the hosted regtest E2E

```bash
pnpm run e2e:regtest
```

The script prints `SENDER_TURNKEY_L1_BTC_ADDRESS` and polls until that address
has a spendable UTXO. While it is waiting, open the Lightspark regtest faucet
and choose the **Bitcoin** receiver option:

```text
https://app.lightspark.com/regtest-faucet
```

Spark hosted `REGTEST` uses Lightspark's Bitcoin regtest chain, not public
Bitcoin testnet or signet.

The script performs the full flow:

1. spends the sender Turnkey `bcrt1p...` UTXO into a Spark single-use L1 deposit address
2. waits for L1 confirmation and claims the deposit into the sender Spark wallet
3. transfers Spark sats from the sender Turnkey Spark wallet to the receiver Turnkey Spark address
4. claims the inbound Spark transfer on the receiver wallet
5. withdraws the receiver Spark balance back to a Turnkey Bitcoin regtest address

Useful E2E settings:

```bash
L1_DEPOSIT_AMOUNT_SATS=              # optional; empty sweeps all sender L1 UTXOs minus fee
L1_DEPOSIT_FEE_SATS=500
L1_DEPOSIT_TXID=                     # optional; retry claiming an already-broadcast deposit tx
L1_FUNDING_TIMEOUT_MS=60000          # how long to wait for faucet funding
L1_FUNDING_POLL_MS=5000
TRANSFER_AMOUNT_SATS=                # optional; empty transfers the sender Spark balance
WITHDRAW_AMOUNT_SATS=                # optional; empty withdraws receiver Spark balance
WITHDRAW_EXIT_SPEED=FAST             # FAST, MEDIUM, or SLOW
```

By default the E2E transfers the sender's full Spark balance. Partial transfer
amounts are also supported: when the wallet does not have an exact leaf for the
requested amount, the example installs a Turnkey-backed leaf swap/change shim so
key tweaks and encrypted operator packages are still built inside Turnkey's
enclave.

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

# From `pnpm run setup:l1` output
TURNKEY_L1_BTC_ADDRESS=...
TURNKEY_L1_BTC_PUBLIC_KEY_HEX=...

# For transfer / token-transfer
RECEIVER_SPARK_ADDRESS=...

# For withdraw
WITHDRAW_BTC_ADDRESS=...

# For deposit (regtest only)
BITCOIN_RPC_URL=http://127.0.0.1:18443
BITCOIN_RPC_USER=user
BITCOIN_RPC_PASS=pass
L1_DEPOSIT_FEE_SATS=500
L1_DEPOSIT_AMOUNT_SATS=              # optional; empty sweeps all L1 funding UTXOs minus fee
L1_DEPOSIT_TXID=                     # optional; retry claiming an already-broadcast deposit tx
L1_FUNDING_TIMEOUT_MS=60000
L1_FUNDING_POLL_MS=5000
L1_DEPOSIT_CONFIRMATION_TIMEOUT_MS=300000
L1_DEPOSIT_CONFIRMATION_POLL_MS=5000

# Optional
SPARK_NETWORK=REGTEST              # or MAINNET
DEPOSIT_AMOUNT_SATS=100000
TRANSFER_AMOUNT_SATS=50000
WITHDRAW_AMOUNT_SATS=25000
```

### Run

```bash
# Token operations (no Bitcoin needed)
pnpm run token-transfer

# Bitcoin L2 operations (requires regtest for deposit)
pnpm run deposit
pnpm run transfer
pnpm run claim
pnpm run withdraw
```

### Hosted regtest faucet deposit

For Spark's hosted `REGTEST`, use Lightspark's regtest faucet with the
**Bitcoin** receiver option to fund a Turnkey `bcrt1p...` address:

```bash
pnpm run setup:l1
# Add TURNKEY_L1_BTC_ADDRESS and TURNKEY_L1_BTC_PUBLIC_KEY_HEX to .env.local.
# Send faucet funds to TURNKEY_L1_BTC_ADDRESS at https://app.lightspark.com/regtest-faucet
pnpm run deposit:turnkey
```

`deposit:turnkey` creates a Spark single-use L1 deposit address, spends the
Turnkey-controlled faucet UTXO into that address with `SIGN_TRANSACTION`, then
waits for the transaction to confirm and calls `wallet.claimDeposit(txid)`. If
there is no funding UTXO yet, it prints the Turnkey Bitcoin address and polls
until you fund it from the faucet. If `L1_DEPOSIT_AMOUNT_SATS` is unset, it
deposits all available funding UTXOs minus `L1_DEPOSIT_FEE_SATS`. To retry
after a timeout, set `L1_DEPOSIT_TXID` to the broadcast transaction ID and rerun
`pnpm run deposit:turnkey`; the script will skip the L1 spend and only
wait/claim.

## Architecture

The `TurnkeySparkSigner` implements the Spark SDK's `SparkSigner` interface, routing all cryptographic operations to Turnkey:

- **ECDSA signing** — `SignRawPayload` (identity key authentication, token operations)
- **Schnorr identity signing** — `SignRawPayload` via the Spark address when Spark auth accepts a 64-byte identity signature
- **FROST signing** — `SPARK_PREPARE_AND_SIGN` (threshold Schnorr for Bitcoin transactions)
- **Key derivation** — `SPARK_KEY_OPERATION` (derive deposit/signing public keys)
- **Transfer/claim orchestration** — `SPARK_PREPARE_AND_SIGN` with package requests (key tweaks + encrypted operator packages, all inside the enclave)

Custom orchestration (`turnkeyTransfer.ts`, `turnkeyClaim.ts`, `turnkeySwap.ts`, `turnkeyWithdraw.ts`) replaces the SDK's built-in transfer/claim/swap flows because the SDK calls `subtractSplitAndEncrypt()` per-leaf, exposing raw Feldman shares client-side. Turnkey's enclave does this atomically — raw shares never leave the enclave boundary.
