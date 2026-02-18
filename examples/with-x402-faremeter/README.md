# Example: `with-x402-faremeter`

This example demonstrates how AI agents can use Turnkey wallets for autonomous payments on Solana via the [x402 protocol](https://github.com/coinbase/x402) using [Faremeter](https://github.com/faremeter/faremeter).

## Overview

This example shows **headless agent signing** with **gasless USDC payments**:

- **Gasless**: The server pays SOL transaction fees; the agent only needs USDC
- **Automatic**: Faremeter handles the 402 payment flow transparently
- **Headless**: No browser or user interaction required

1. Agent authenticates with Turnkey using API keys (no browser/WebAuthn)
2. Agent creates or retrieves a Solana wallet
3. Agent wraps `fetch` with Faremeter's `@faremeter/fetch` to handle x402 payment flows
4. When a paywalled resource returns HTTP 402, Faremeter automatically negotiates payment via the agent's Turnkey-managed wallet
5. The signed payment is submitted and the original request is retried with proof of payment

## How It Works

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   AI Agent  │         │   Turnkey   │         │  x402       │
│             │         │   API       │         │  Resource   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  1. Init with API keys│                       │
       │──────────────────────>│                       │
       │                       │                       │
       │  2. Get/Create wallet │                       │
       │──────────────────────>│                       │
       │<──────────────────────│                       │
       │      Solana address   │                       │
       │                       │                       │
       │  3. Request resource  │                       │
       │───────────────────────────────────────────────>
       │<───────────────────────────────────────────────
       │      402 Payment Required                     │
       │                       │                       │
       │  4. Sign payment tx   │                       │
       │──────────────────────>│                       │
       │<──────────────────────│                       │
       │      Signed tx        │                       │
       │                       │                       │
       │  5. Retry with payment│                       │
       │───────────────────────────────────────────────>
       │<───────────────────────────────────────────────
       │      200 OK + content │                       │
       │                       │                       │
```

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable
pnpm install -r
pnpm run build-all
cd examples/with-x402-faremeter/
```

### 2. Configure Environment

Copy the template and fill in your Turnkey credentials:

```bash
cp .env.local.example .env.local
```

Now open `.env.local` and add the missing values:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `ORGANIZATION_ID`

You can optionally configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Turnkey API URL | `https://api.turnkey.com` |
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `TEST_PAYWALL_URL` | x402-enabled endpoint to test against | _(none)_ |

**Recommended test endpoint:**

```bash
TEST_PAYWALL_URL=https://x402.payai.network/api/solana-devnet/paid-content
```

This is the [x402 Echo Server](https://x402.payai.network/) — a free test environment that simulates payments on devnet. Tokens are automatically refunded.

### 3. Run the Demo

```bash
pnpm start
```

**Without `TEST_PAYWALL_URL`**, the demo initializes the agent and reports readiness:

```
🤖 Initializing Turnkey Agent...

✅ Turnkey client initialized
✅ Agent wallet: DJr1iJ...
💰 SOL Balance: 5 SOL
💵 USDC Balance: 20.00 USDC

✅ Faremeter x402 client ready

ℹ️  No TEST_PAYWALL_URL configured.
   Set this env var to test the x402 payment flow.

──────────────────────────────────────────────────
Agent Summary:
  Wallet Address: DJr1iJ...
  SOL Balance: 5 SOL
  USDC Balance: 20.00 USDC
  Network: devnet
  Faremeter Client: ready
──────────────────────────────────────────────────

✅ Agent ready for x402 payments!
```

**With `TEST_PAYWALL_URL`**, the demo fetches the paywalled resource, automatically pays via Faremeter when a 402 is returned, and displays the content along with USDC spent:

```
📡 Fetching paywalled resource: https://x402.payai.network/api/solana-devnet/paid-content

✅ Content received!
──────────────────────────────────────────────────
{"message":"Payment verified! Here is your protected content..."}
──────────────────────────────────────────────────

💰 Final SOL balance: 5 SOL
💵 Final USDC balance: 19.99 USDC
📊 SOL spent: 0 SOL
📊 USDC spent: 0.010000 USDC
```

### 4. Fund Your Agent Wallet

The agent needs **USDC** to make payments (SOL fees are covered by the server in gasless mode).

**Get devnet USDC:**

1. Visit the [Circle Faucet](https://faucet.circle.com/)
2. Select "Solana Devnet"
3. Enter your wallet address

**Get devnet SOL** (optional, for non-gasless servers):

```bash
solana airdrop 1 <WALLET_ADDRESS> --url devnet
```

Or use the [Solana Faucet](https://faucet.solana.com/).

## Core Code

The key integration is wrapping `fetch` with Faremeter and a custom gasless payment handler:

```typescript
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import { wrap as wrapFetch } from "@faremeter/fetch";
import type { PaymentHandler } from "@faremeter/types/client";

const turnkey = new Turnkey({ /* API key config */ });
const signer = new TurnkeySigner({
  organizationId: process.env.ORGANIZATION_ID,
  client: turnkey.apiClient(),
});

const address = await getOrCreateSolanaWallet(turnkey.apiClient());

// Create a gasless payment handler that uses the server's fee payer
const gaslessHandler: PaymentHandler = async (_ctx, accepts) => {
  // Find requirements with a fee payer (gasless)
  const req = accepts.find((r) => r.extra?.feePayer);
  if (!req) return [];

  return [{
    requirements: req,
    exec: async () => {
      // Build transaction with server's fee payer
      // Sign with Turnkey
      const signedTx = await signer.signTransaction(tx, address);
      return { payload: { transaction: base64Encode(signedTx) } };
    },
  }];
};

// Wrap fetch so 402 responses are automatically handled
const x402Fetch = wrapFetch(fetch, {
  handlers: [gaslessHandler],
  retryCount: 3,
});

// Use x402Fetch like normal fetch — payments happen transparently
const response = await x402Fetch("https://x402.payai.network/api/solana-devnet/paid-content");
```

See [`src/index.ts`](./src/index.ts) for the complete implementation including v1/v2 protocol normalization.

## Security Considerations

When deploying agents with payment capabilities:

1. **Never commit API keys** — Use environment variables or secrets management
2. **Use sub-organizations** — Isolate agent wallets from your main organization
3. **Set spending limits** — Use [Turnkey policies](https://docs.turnkey.com/concepts/policies) to cap transaction amounts
4. **Monitor activity** — Track agent spending via the Turnkey dashboard
5. **Rotate keys regularly** — Update API keys periodically

## Related Examples

- [`with-solana`](../with-solana/) — Interactive Solana signing demo

## Resources

- [Turnkey Documentation](https://docs.turnkey.com/)
- [Faremeter GitHub](https://github.com/faremeter/faremeter)
- [Faremeter Documentation](https://docs.corbits.dev/faremeter/overview)
- [x402 Protocol](https://github.com/coinbase/x402)
- [x402 Echo Server](https://x402.payai.network/) — Free test environment
- [Circle Faucet](https://faucet.circle.com/) — Get devnet USDC
- [Solana Faucet](https://faucet.solana.com/) — Get devnet SOL
