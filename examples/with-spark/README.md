# Example: `with-spark`

This example demonstrates how to use [Spark](https://spark.money) — Bitcoin's instant, zero-fee payment layer — with Turnkey.

It covers the core Spark SDK operations:

- Initializing (or restoring) a Spark wallet
- Retrieving Spark and deposit addresses
- Checking Bitcoin balance
- Sending a transfer to another Spark address
- Listing recent transfers

> **Note on Turnkey integration:** A deeper integration — where Turnkey holds the wallet's private key material and the Spark `SparkSigner` interface delegates all signing to Turnkey — is planned. For now this example uses a standard BIP39 mnemonic stored in `.env.local`.

---

## Getting started

### 1/ Cloning the repo

Make sure you have `Node.js` v18+ installed.

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install -r
pnpm run build-all
cd examples/with-spark/
```

---

### 2/ Setting up Spark

Follow [Spark's quickstart](https://docs.spark.money/wallets/typescript) for background. No API key is needed for REGTEST.

Create a `.env.local` file:

```bash
cp .env.local.example .env.local
```

You can leave `MNEMONIC` blank on the first run — a new wallet will be generated and the mnemonic printed to stdout. Copy it into `.env.local` to restore the same wallet on subsequent runs.

Set `SPARK_NETWORK` to `MAINNET` for production (real Bitcoin).

---

### 3/ (Optional) Setting up Turnkey

The Turnkey credentials in `.env.local` (`API_PUBLIC_KEY`, `API_PRIVATE_KEY`, `ORGANIZATION_ID`) are included for future use when the deeper Turnkey + SparkSigner integration is added.

Follow the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) to get your credentials if you want to prepare for that step.

---

### 4/ Running the script

```bash
pnpm start
```

On first run (no mnemonic set), output looks like:

```
Initializing Spark wallet on REGTEST...

New wallet generated. Save this mnemonic somewhere safe:
  word1 word2 word3 ... word12

Set MNEMONIC in .env.local to restore this wallet next time.

Spark address:       sparkrt1...
Identity public key: 02...
Deposit address:     bcrt1p...

Balance: 0 sats

No RECEIVER_SPARK_ADDRESS set — skipping transfer demo.
Fund your deposit address and set RECEIVER_SPARK_ADDRESS to demo transfers.
```

To demo a transfer, fund your deposit address using the [Spark faucet](https://docs.spark.money/developer-tools/faucet) (REGTEST), then set `RECEIVER_SPARK_ADDRESS` to another Spark address and re-run.

---

## Next steps

- **Turnkey + SparkSigner**: Implement the `SparkSigner` interface to delegate all private key operations to Turnkey, enabling server-side key management without ever exposing key material.
- **Lightning**: Use `wallet.payLightningInvoice()` and `wallet.createLightningInvoice()` to send/receive via Lightning.
- **Token transfers**: Use `wallet.transferTokens()` to move Spark-native tokens (e.g. USDT on Spark).
