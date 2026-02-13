# Example: `with-x402-faremeter`

This example demonstrates how AI agents can use Turnkey wallets for autonomous payments on Solana via the [x402 protocol](https://github.com/coinbase/x402) using [Faremeter](https://github.com/faremeter/faremeter).

## Overview

Unlike browser-based examples that require user interaction, this example shows **headless agent signing**:

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
| `FAREMETER_FACILITATOR_URL` | Faremeter facilitator URL | Public facilitator |
| `TEST_PAYWALL_URL` | x402-enabled endpoint to test against | _(none)_ |

### 3. Run the Demo

```bash
pnpm start
```

**Without `TEST_PAYWALL_URL`**, the demo initializes the agent and reports readiness:

```
🤖 Initializing Turnkey Agent...

✅ Turnkey client initialized
Using existing Solana wallet: ABC123...
✅ Agent wallet: ABC123...
💰 Balance: 1 SOL

✅ Faremeter x402 client ready

ℹ️  No TEST_PAYWALL_URL configured.
   Set this env var to test the x402 payment flow.

──────────────────────────────────────────────────
Agent Summary:
  Wallet Address: ABC123...
  Balance: 1 SOL
  Network: devnet
  x402 Client: ready
──────────────────────────────────────────────────

✅ Agent ready for x402 payments!
```

**With `TEST_PAYWALL_URL`**, the demo also fetches the paywalled resource, automatically pays via Faremeter if a 402 is returned, and displays the content along with the amount spent.

### 4. Fund Your Agent Wallet

On Solana devnet, request free SOL:

```bash
solana airdrop 1 <WALLET_ADDRESS> --url devnet
```

Or use the [Solana Faucet](https://faucet.solana.com/).

## Core Code

The key integration is wrapping `fetch` with Faremeter and a Turnkey signer:

```typescript
import { Turnkey } from "@turnkey/sdk-server";
import { TurnkeySigner } from "@turnkey/solana";
import { wrapFetch } from "@faremeter/fetch";

const turnkey = new Turnkey({ /* API key config */ });
const signer = new TurnkeySigner({
  organizationId: process.env.ORGANIZATION_ID,
  client: turnkey.apiClient(),
});

const address = await getOrCreateSolanaWallet(turnkey.apiClient());

// Wrap fetch so 402 responses are automatically handled
const x402Fetch = wrapFetch(fetch, {
  paymentSigner: async (transaction) => {
    return await signer.signTransaction(transaction, address);
  },
  network: "solana:devnet",
});

// Use x402Fetch like normal fetch — payments happen transparently
const response = await x402Fetch("https://paywall.example.com/resource");
```

## Security Considerations

When deploying agents with payment capabilities:

1. **Never commit API keys** — Use environment variables or secrets management
2. **Use sub-organizations** — Isolate agent wallets from your main organization
3. **Set spending limits** — Use [Turnkey policies](https://docs.turnkey.com/concepts/policies) to cap transaction amounts
4. **Monitor activity** — Track agent spending via the Turnkey dashboard
5. **Rotate keys regularly** — Update API keys periodically

## Related Examples

- [`with-solana`](../with-solana/) — Interactive Solana signing demo
- [`with-x402`](../with-x402/) — Browser-based x402 payments with Turnkey embedded wallets

## Resources

- [Turnkey Documentation](https://docs.turnkey.com/)
- [Faremeter GitHub](https://github.com/faremeter/faremeter)
- [Faremeter Documentation](https://docs.corbits.dev/faremeter/overview)
- [x402 Protocol](https://github.com/coinbase/x402)
- [Solana Faucet](https://faucet.solana.com/)
