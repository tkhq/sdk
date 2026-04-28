# Example: `with-spark`

Demonstrates [Spark](https://spark.money) operations using **Turnkey as the key custodian**. Private keys never leave Turnkey's enclave — all signing happens via Turnkey activities.

## Operations

| Script | What it does | Turnkey activity |
|--------|-------------|-----------------|
| `pnpm run setup:e2e` | Create sender + receiver Spark wallets and Bitcoin regtest accounts | `CREATE_WALLET` + `CREATE_WALLET_ACCOUNTS` |
| `pnpm run e2e:regtest` | Deposit BTC into Spark, transfer, claim, and withdraw back to BTC | `SIGN_TRANSACTION` + `SPARK_*` |
| `pnpm run e2e:lightning-regtest` | Create a Lightning invoice, pay it, and verify receiver Spark settlement | `SPARK_PREPARE_AND_SIGN` (`lightning_receive` + Lightning key tweaks) |
| `pnpm run setup` | Create one Turnkey Spark wallet | `CREATE_WALLET` |
| `pnpm run setup:l1` | Create/reuse a Turnkey Bitcoin regtest funding address | `CREATE_WALLET_ACCOUNTS` |
| `pnpm run token-transfer` | Create, mint, and transfer a Spark token | `SignRawPayload` (ECDSA) |
| `pnpm run deposit` | Spend a Turnkey bcrt1p faucet UTXO into Spark and claim it | `SIGN_TRANSACTION` + `SPARK_PREPARE_AND_SIGN` |
| `pnpm run transfer` | Send sats to another Spark address | `SPARK_PREPARE_AND_SIGN` (FROST + key tweaks) |
| `pnpm run claim` | Receive an inbound Spark transfer | `SPARK_PREPARE_AND_SIGN` (verify + decrypt + key tweaks) |
| `pnpm run lightning:receive` | Create a Lightning invoice backed by Turnkey-generated Spark preimage shares | `SPARK_PREPARE_AND_SIGN` (`lightning_receive`) |
| `pnpm run lightning:send` | Pay a BOLT11 invoice from a Turnkey Spark balance | `SPARK_PREPARE_AND_SIGN` (FROST + Lightning key tweaks) |
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
Bitcoin testnet or signet. No local Bitcoin node is required; the example uses
hosted Spark services, hosted Electrs, and the Lightspark faucet.

The script performs the full flow:

1. spends the sender Turnkey `bcrt1p...` UTXO into a Spark single-use L1 deposit address
2. waits for L1 confirmation and claims the deposit into the sender Spark wallet
3. transfers Spark sats from the sender Turnkey Spark wallet to the receiver Turnkey Spark address
4. claims the inbound Spark transfer on the receiver wallet
5. withdraws the transferred Spark sats back to a Turnkey Bitcoin regtest address

Useful E2E settings:

```bash
L1_DEPOSIT_AMOUNT_SATS=              # optional; empty sweeps all sender L1 UTXOs minus fee
L1_DEPOSIT_FEE_SATS=500
L1_DEPOSIT_TXID=                     # optional; retry claiming an already-broadcast deposit tx
L1_FUNDING_TIMEOUT_MS=60000          # how long to wait for faucet funding
L1_FUNDING_POLL_MS=5000
TRANSFER_AMOUNT_SATS=                # optional; empty transfers the sender Spark balance
WITHDRAW_AMOUNT_SATS=                # optional; empty withdraws this run's transfer amount
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

# For Lightning receive / send
LIGHTNING_AMOUNT_SATS=1000
LIGHTNING_INVOICE=
LIGHTNING_MAX_FEE_SATS=1000
LIGHTNING_AMOUNT_SATS_TO_SEND=        # only for zero-amount BOLT11 invoices

# For hosted REGTEST deposit
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

# Bitcoin / Spark operations on hosted REGTEST
pnpm run setup:l1
pnpm run deposit
pnpm run transfer
pnpm run claim
pnpm run lightning:receive
LIGHTNING_INVOICE=<bolt11> pnpm run lightning:send
pnpm run e2e:lightning-regtest
pnpm run withdraw
```

### Lightning receive / send

`lightning:receive` creates a BOLT11 invoice without exposing the preimage or
preimage shares to client JS. The example first asks Turnkey to run the existing
Spark `lightning_receive` package request, which returns only:

- `payment_hash`
- encrypted preimage-share packages for Spark operators

The script then creates a hodl Lightning invoice with that payment hash and
stores the encrypted preimage shares with Spark.

```bash
LIGHTNING_AMOUNT_SATS=1000 pnpm run lightning:receive
```

`lightning:send` pays a BOLT11 invoice from the wallet's Spark balance. For
zero-amount invoices, set `LIGHTNING_AMOUNT_SATS_TO_SEND`.

```bash
LIGHTNING_INVOICE=lnbcrt... LIGHTNING_MAX_FEE_SATS=1000 pnpm run lightning:send
```

For two-wallet `.env.local` files created by `setup:e2e`, use the optional env
prefixes to choose which wallet runs each side:

```bash
LIGHTNING_RECEIVER_ENV_PREFIX=RECEIVER_ pnpm run lightning:receive
LIGHTNING_SENDER_ENV_PREFIX=SENDER_ LIGHTNING_INVOICE=lnbcrt... pnpm run lightning:send
```

### Hosted REGTEST Lightning E2E

`e2e:lightning-regtest` automates the hosted REGTEST Lightning proof with two
Turnkey Spark wallets. It ensures the sender has enough Spark sats, creating a
Turnkey L1 deposit and waiting for faucet funding if needed; creates a receiver
Lightning invoice; pays it from the sender wallet; then claims or verifies the
receiver Spark settlement.

1. Create sender and receiver wallets.

```bash
pnpm run setup:e2e
```

Copy the printed `SENDER_*` and `RECEIVER_*` values into `.env.local`.

2. Run the Lightning E2E.

```bash
LIGHTNING_AMOUNT_SATS=500 pnpm run e2e:lightning-regtest
```

If the sender does not have enough Spark balance, the script prints
`SENDER_TURNKEY_L1_BTC_ADDRESS` and waits while you fund it from the Lightspark
regtest faucet using the **Bitcoin** receiver option:

```text
https://app.lightspark.com/regtest-faucet
```

To retry an already-broadcast L1 deposit without spending another UTXO, set
`L1_DEPOSIT_TXID` and rerun the E2E.

The one-shot scripts below remain useful when debugging individual steps.

### Manual Lightning steps

1. Put Spark sats in the sender wallet.

If the sender already has Spark sats, skip this step. Otherwise, run the hosted
REGTEST deposit E2E with a small transfer amount so most funds remain in the
sender wallet:

```bash
TRANSFER_AMOUNT_SATS=1000 WITHDRAW_AMOUNT_SATS=1000 pnpm run e2e:regtest
```

When prompted, fund `SENDER_TURNKEY_L1_BTC_ADDRESS` from the Lightspark
regtest faucet using the **Bitcoin** receiver option:

```text
https://app.lightspark.com/regtest-faucet
```

This deposits faucet BTC into the sender Spark wallet, sends 1000 sats to the
receiver through the regular Spark transfer path, withdraws those 1000 receiver
sats, and leaves the sender with the remaining Spark balance for the Lightning
send.

2. Create a Lightning invoice on the receiver wallet.

```bash
LIGHTNING_RECEIVER_ENV_PREFIX=RECEIVER_ \
LIGHTNING_AMOUNT_SATS=500 \
pnpm run lightning:receive
```

Copy the printed `Invoice:` value.

3. Pay the invoice from the sender wallet.

```bash
LIGHTNING_SENDER_ENV_PREFIX=SENDER_ \
LIGHTNING_INVOICE=lnbcrt... \
LIGHTNING_MAX_FEE_SATS=1000 \
pnpm run lightning:send
```

For a zero-amount BOLT11 invoice, also set `LIGHTNING_AMOUNT_SATS_TO_SEND`.

4. Claim or verify receiver settlement.

```bash
CLAIM_ENV_PREFIX=RECEIVER_ pnpm run claim
```

The claim script prints the receiver balance after claiming any pending
transfers. If it reports no pending transfers, rerun it after a short delay or
query the receiver balance by reinitializing the receiver wallet.

Current caveats:

- This Lightning path is live-proven on hosted REGTEST with a 500-sat BOLT11
  invoice, a 3-sat send fee, and receiver settlement back into Spark.
- `e2e:lightning-regtest` automates the invoice, payment, and receiver
  settlement proof; withdrawal remains covered by `e2e:regtest`.
- Lightning send currently signs refunds twice: once while building the
  Turnkey-backed transfer request and once inside the SDK's
  `swapNodesForPreimage(...)` path. Expect roughly `6n + 1`
  `SPARK_PREPARE_AND_SIGN` activities for `n` selected leaves until the SDK swap
  path is forked or exposes a way to reuse the prebuilt request without
  redundant signing.
- It requires the Turnkey environment you are hitting to have
  `SPARK_PREPARE_AND_SIGN.package_request.lightningReceive` deployed.
- Generic HTLC convenience flows are not covered here; this tests Lightning
  invoice receive plus BOLT11 payment.

### Hosted regtest faucet deposit

For Spark's hosted `REGTEST`, use Lightspark's regtest faucet with the
**Bitcoin** receiver option to fund a Turnkey `bcrt1p...` address:

```bash
pnpm run setup:l1
# Add TURNKEY_L1_BTC_ADDRESS and TURNKEY_L1_BTC_PUBLIC_KEY_HEX to .env.local.
# Send faucet funds to TURNKEY_L1_BTC_ADDRESS at https://app.lightspark.com/regtest-faucet
pnpm run deposit
```

`deposit` creates a Spark single-use L1 deposit address, spends the
Turnkey-controlled faucet UTXO into that address with `SIGN_TRANSACTION`, then
waits for the transaction to confirm and calls `wallet.claimDeposit(txid)`. If
there is no funding UTXO yet, it prints the Turnkey Bitcoin address and polls
until you fund it from the faucet. If `L1_DEPOSIT_AMOUNT_SATS` is unset, it
deposits all available funding UTXOs minus `L1_DEPOSIT_FEE_SATS`. To retry
after a timeout, set `L1_DEPOSIT_TXID` to the broadcast transaction ID and rerun
`pnpm run deposit`; the script will skip the L1 spend and only wait/claim.

The hosted REGTEST Electrs endpoint requires basic auth. The example uses the
same default hosted REGTEST credentials as the Spark SDK and does not print them.
For a custom protected endpoint, set `SPARK_REGTEST_ELECTRS_USER` and
`SPARK_REGTEST_ELECTRS_PASSWORD`.

## Architecture

The `TurnkeySparkSigner` implements the Spark SDK's `SparkSigner` interface, routing all cryptographic operations to Turnkey:

- **ECDSA signing** — `SignRawPayload` (identity key authentication, token operations)
- **Schnorr identity signing** — `SignRawPayload` via the Spark address when Spark auth accepts a 64-byte identity signature
- **FROST signing** — `SPARK_PREPARE_AND_SIGN` (threshold Schnorr for Bitcoin transactions)
- **Key derivation** — `SPARK_KEY_OPERATION` (derive deposit/signing public keys)
- **Transfer/claim orchestration** — `SPARK_PREPARE_AND_SIGN` with package requests (key tweaks + encrypted operator packages, all inside the enclave)

Custom orchestration (`turnkeyTransfer.ts`, `turnkeyClaim.ts`, `turnkeySwap.ts`, `turnkeyWithdraw.ts`) replaces the SDK's built-in transfer/claim/swap flows because the SDK calls `subtractSplitAndEncrypt()` per-leaf, exposing raw Feldman shares client-side. Turnkey's enclave does this atomically — raw shares never leave the enclave boundary.
