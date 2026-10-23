# Example: `execute-swap`

> **Closed beta:** Turnkey Swap is currently in closed beta. Your organization must be allowlisted (with the relevant swap feature flags enabled) before this example will work.

This example uses the typed swap methods from `@turnkey/sdk-server`. It submits create-swap-quote V2 and execute-swap V3 activities.

By default it is configured for Solana mainnet SOL → USDC. Token pair and amount are driven by env vars (`FROM_TOKEN` / `TO_TOKEN` as CAIP-19 asset IDs, `AMOUNT` in base units), so you can point it at other supported pairs without code changes.

The script will:

1. Call `createSwapQuote` (V2) with the tokens, amount, slippage, and optional destination address
2. Prompt whether to use Turnkey gas sponsorship
3. Call `executeSwap` (V3) with the selected quote and the same destination address
4. Poll `getSwapStatus` with the returned `swapRequestId` until `COMPLETED` or a terminal failure

---

## Getting started

### 1/ Cloning the example

Make sure you have `Node.js` installed locally; we recommend using Node v18+.

```bash
$ git clone https://github.com/tkhq/sdk
$ cd sdk/
$ corepack enable
$ pnpm install -r
$ pnpm run build-all
$ cd examples/defi/execute-swap/
```

---

### 2/ Setting up Turnkey

Follow the [Quickstart](https://docs.turnkey.com/getting-started/quickstart) to create:

- A Turnkey API key pair
- An organization ID
- A Turnkey wallet account

Because Swap is in closed beta, also confirm your organization is allowlisted for swap. For Solana swaps you typically need:

- `FEATURE_FLAG_SWAP`
- `FEATURE_FLAG_SOL_SEND_TRANSACTION`

Once ready, create a `.env.local` file:

```bash
$ cp .env.local.example .env.local
```

Fill in the following values:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `BASE_URL`
- `ORGANIZATION_ID`
- `SIGN_WITH` — Turnkey wallet account address used as `signWith` on `createSwapQuote` (signer is derived from the quote on execute)
- `FROM_TOKEN` — CAIP-19 input asset ID
- `TO_TOKEN` — CAIP-19 output asset ID
- `DESTINATION_ADDRESS` — optional raw output address. Set this value for a cross-protocol swap.
- `AMOUNT` — input amount in base units (for example, lamports for SOL)

The example defaults to Solana mainnet SOL → USDC with `AMOUNT=5000000` (0.005 SOL).

---

### 3/ Running the script

```bash
$ pnpm start
```

You will be prompted to choose whether to use Turnkey gas sponsorship. On success, the script prints swap status details and, when available, Solscan links for the origin/destination transactions.
