# Example: `with-spark-schnorr`

Demonstrates minting and transferring a [Spark](https://spark.money) token with **Turnkey as the key custodian**. Turnkey signs each token transaction via Schnorr (`signRawPayload`) through a custom `TurnkeySparkSigner`, while the `IssuerSparkWallet` handles all transaction construction, serialization, and broadcasting.

The script runs three steps in sequence:

1. **CREATE** — announces a new token (name, ticker, decimals, max supply).
2. **MINT** — issues tokens to the issuer's own Spark address.
3. **TRANSFER** — sends tokens to `RECEIVER_SPARK_ADDRESS`.

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

| Variable                  | Required | Notes                                              |
| ------------------------- | -------- | -------------------------------------------------- |
| `API_PUBLIC_KEY`          | Yes      | Turnkey API public key                             |
| `API_PRIVATE_KEY`         | Yes      | Turnkey API private key                            |
| `ORGANIZATION_ID`         | Yes      | Turnkey organization ID                            |
| `TURNKEY_IDENTITY_ADDRESS`| Yes      | Turnkey key address holding the Spark identity key |
| `IDENTITY_PUBLIC_KEY_HEX` | Yes      | Compressed 33-byte public key of the identity key (hex) |
| `RECEIVER_SPARK_ADDRESS`  | Yes      | Spark address to receive the token transfer        |
| `BASE_URL`                | No       | Turnkey API base URL (default: `https://api.turnkey.com`) |
| `SPARK_NETWORK`           | No       | `REGTEST` (default) or `MAINNET`                   |
| `TOKEN_NAME`              | No       | Default: `TurnkeyTestToken`                        |
| `TOKEN_TICKER`            | No       | Default: `TKT`                                     |
| `TOKEN_DECIMALS`          | No       | Default: `0`                                       |
| `TOKEN_SUPPLY`            | No       | Max supply to create (default: `1000000`)           |
| `MINT_AMOUNT`             | No       | Tokens to mint (default: `TOKEN_SUPPLY`)           |
| `TRANSFER_AMOUNT`         | No       | Tokens to transfer (default: `MINT_AMOUNT`)        |

### 3. Run

```bash
pnpm start
```

---

## Expected output

```
Initializing IssuerSparkWallet on REGTEST...
✅ Authenticated to Spark SO

Spark address:       sp1...
Identity public key: 02...

── Step 1: CREATE token ────────────────────────────────────
  Name:       TurnkeyTestToken
  Ticker:     TKT
  Decimals:   0
  Max supply: 1,000,000
✅ Token created
   Token identifier: <hex>

── Step 2: MINT 1,000,000 tokens ────────────────────────────
✅ Tokens minted
   Tx ID: <hex>
   Balance: 1000000 TKT

── Step 3: TRANSFER 1,000,000 tokens ────────────────────
   To: sp1...
✅ Transfer broadcast
   Tx ID: <hex>
   Status: TRANSFER_STATUS_SENDER_KEY_TWEAKED

── Final balances ─────────────────────────────────────────
   TKT: 0

✅ Token operations succeeded with Turnkey signing!
```
