# Example: `with-spark-schnorr`

Tests native Schnorr signing via the [Spark SDK](https://spark.money) (`DefaultSparkSigner`) and optionally compares the output against a Turnkey-backed signer — useful for verifying that a custom `SparkSigner` implementation produces identical signatures.

The script covers:

1. **Mnemonic → Spark keys**: derives the identity key and deposit (P2TR) key from a BIP-39 mnemonic using `DefaultSparkSigner`.
2. **Raw Schnorr (identity key)**: calls `signSchnorrWithIdentityKey` and optionally compares against `Turnkey.signRawPayload`.
3. **Bitcoin P2TR transaction (deposit key)**: if a regtest UTXO is supplied, builds a `@scure/btc-signer` transaction, computes the sighash with `getSigHashFromTx`, and signs with `signTransactionIndex`. The resulting hex can be broadcast via `bitcoin-cli`.
4. **Spark network acceptance**: initialises a full `SparkWallet` on `REGTEST` and optionally sends a Spark transfer — exercising the complete FROST signing flow against the live network.

---

## Getting started

### 1. Clone & install

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install -r
pnpm run build-all
cd examples/with-spark-schnorr/
```

### 2. Configure `.env.local`

```bash
cp .env.local.example .env.local
```

| Variable | Required | Notes |
|---|---|---|
| `MNEMONIC` | No | Leave blank to auto-generate |
| `SPARK_NETWORK` | No | `REGTEST` (default) or `MAINNET` |
| `RECEIVER_SPARK_ADDRESS` | No | Spark transfer target |
| `TRANSFER_AMOUNT_SATS` | No | Default 1000 |
| `API_PUBLIC_KEY` / `API_PRIVATE_KEY` / `ORGANIZATION_ID` | No | For Turnkey comparison |
| `TURNKEY_IDENTITY_ADDRESS` | No | Turnkey key that holds the same identity private key |
| `UTXO_TXID` / `UTXO_VOUT` / `UTXO_VALUE` / `DESTINATION_ADDRESS` | No | For P2TR Bitcoin tx test |
| `FEE_SATS` | No | Default 300 |

### 3. Run

```bash
pnpm start
```

---

## Signature comparison with Turnkey

If you have a `SparkSigner` backed by Turnkey (signing via `signRawPayload`) and want to verify it produces the same Schnorr signatures as the native SDK, set the Turnkey env vars and `TURNKEY_IDENTITY_ADDRESS`. The script signs the same payload with both signers and prints whether the signatures match.

```
── Schnorr signature (identity key) ──────────────────────────
Payload (hex): 737061726b2d7363686e6f72722d74657374...
Spark SDK sig: <64-byte hex>
Turnkey sig:   <64-byte hex>

Signatures match: ✅  YES
```
