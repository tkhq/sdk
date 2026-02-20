# Example: `with-x402-faremeter`

Build a headless Solana agent that automatically pays x402-protected endpoints, using Turnkey for authentication, wallet management, and signing, plus [Faremeter](https://github.com/faremeter/faremeter) for x402 orchestration.

## Why This Example

- **Headless**: API key auth only (no browser/WebAuthn flow).
- **Turnkey-powered**: secure API auth, wallet provisioning, and Solana transaction signing.
- **Automatic**: Faremeter wraps `fetch` and handles `402` payment retries.
- **Gasless on Echo**: server pays SOL fees; your agent pays in USDC.
- **Practical**: includes balance checks, network/asset compatibility checks, and useful errors.

## Where Turnkey Is Used

| Capability          | How Turnkey is used in this example                                               |
| ------------------- | --------------------------------------------------------------------------------- |
| API authentication  | `@turnkey/sdk-server` authenticates with `API_PUBLIC_KEY` / `API_PRIVATE_KEY`     |
| Wallet lifecycle    | The example gets or creates a Solana wallet in your Turnkey organization          |
| Transaction signing | `@turnkey/solana` signs Solana payment transactions without exposing private keys |
| Security controls   | You can apply Turnkey policies to constrain what this agent can sign/spend        |

Note: In this Echo flow, transaction fees are sponsored by the x402 server's fee payer. Turnkey is the secure signer for the payer wallet.

## Quickstart

From repo root:

```bash
pnpm install -r
pnpm run build-all
cd examples/with-x402-faremeter
cp .env.local.example .env.local
```

Add values to `.env.local`:

```bash
API_PUBLIC_KEY=...
API_PRIVATE_KEY=...
ORGANIZATION_ID=...
TEST_PAYWALL_URL=https://x402.payai.network/api/solana-devnet/paid-content
```

Run:

```bash
pnpm start
```

You should see:

- `✅ Faremeter x402 client ready`
- `✅ Content received!`

## Prerequisites

- Node.js 18+
- `pnpm`
- Turnkey API key pair + organization ID
- Devnet USDC for testing (from [Circle Faucet](https://faucet.circle.com/))
- Optional devnet SOL (for non-gasless endpoints)

## Environment Variables

| Variable           | Required | Description             | Default                         |
| ------------------ | -------- | ----------------------- | ------------------------------- |
| `API_PUBLIC_KEY`   | Yes      | Turnkey API public key  | -                               |
| `API_PRIVATE_KEY`  | Yes      | Turnkey API private key | -                               |
| `ORGANIZATION_ID`  | Yes      | Turnkey organization ID | -                               |
| `TEST_PAYWALL_URL` | No       | x402 endpoint to test   | -                               |
| `SOLANA_RPC_URL`   | No       | Solana RPC endpoint     | `https://api.devnet.solana.com` |
| `BASE_URL`         | No       | Turnkey API base URL    | `https://api.turnkey.com`       |

Recommended test endpoint:

```bash
TEST_PAYWALL_URL=https://x402.payai.network/api/solana-devnet/paid-content
```

This is the [x402 Echo Server](https://x402.payai.network/), a free devnet test environment.

## Funding the Wallet

For Echo, the agent mainly needs **USDC**.

Get devnet USDC:

1. Go to [Circle Faucet](https://faucet.circle.com/)
2. Select **Solana Devnet**
3. Paste your wallet address

Optional SOL airdrop:

```bash
solana airdrop 1 <WALLET_ADDRESS> --url devnet
```

## How It Works

1. Initialize Turnkey API client + `TurnkeySigner`
2. Get or create a Solana wallet
3. Check SOL and USDC balances
4. Wrap `fetch` with Faremeter and a gasless payment handler
5. Make request:
   - if `200`: return content
   - if `402`: build/sign payment payload and retry automatically

## Example Success Output

```text
✅ Faremeter x402 client ready
📡 Fetching paywalled resource: https://x402.payai.network/api/solana-devnet/paid-content
✅ Content received!
{"success":true,"transaction":"...","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","payer":"...","premiumContent":"...","refundTransaction":"..."}
💰 Final SOL balance: ...
💵 Final USDC balance: ...
📊 SOL spent: ...
📊 USDC spent: ...
```

On Echo, USDC can be refunded quickly, so net spend may show as `0.000000`.

## Core Integration

The `createX402Client` factory in `src/x402-client.ts` handles all the setup:

```typescript
import { createX402Client } from "./x402-client.js";

const { x402Fetch, walletAddress, getBalances, network } = await createX402Client({
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  organizationId: process.env.ORGANIZATION_ID!,
  rpcUrl: process.env.SOLANA_RPC_URL,    // optional
  baseUrl: process.env.BASE_URL,          // optional
});

// Use x402Fetch exactly like regular fetch - payments are automatic
const response = await x402Fetch("https://paid-api.example.com/data");
```

The client handles Turnkey authentication, wallet provisioning, transaction signing, and x402 protocol negotiation internally.

## Integrating With Your Agent Framework

The `x402Fetch` function works like standard `fetch()`, making it easy to expose as a tool in any LLM framework. Below are copy-paste examples for common setups.

### OpenAI Function Calling

```typescript
import OpenAI from "openai";
import { createX402Client } from "./x402-client.js";

const { x402Fetch } = await createX402Client({ /* ... */ });
const openai = new OpenAI();

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "fetch_paid_resource",
      description: "Fetch data from a URL. Automatically pays if the endpoint requires payment (HTTP 402).",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
];

async function handleToolCall(name: string, args: { url: string }): Promise<string> {
  if (name === "fetch_paid_resource") {
    const response = await x402Fetch(args.url);
    return response.text();
  }
  throw new Error(`Unknown tool: ${name}`);
}

// In your chat loop:
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Get the premium data from https://api.example.com/premium" }],
  tools,
});

if (response.choices[0].message.tool_calls) {
  for (const toolCall of response.choices[0].message.tool_calls) {
    const result = await handleToolCall(
      toolCall.function.name,
      JSON.parse(toolCall.function.arguments),
    );
    // Continue conversation with tool result...
  }
}
```

### Anthropic Tool Use

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { createX402Client } from "./x402-client.js";

const { x402Fetch } = await createX402Client({ /* ... */ });
const anthropic = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "fetch_paid_resource",
    description: "Fetch data from a URL. Automatically pays if the endpoint requires payment (HTTP 402).",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
      },
      required: ["url"],
    },
  },
];

async function handleToolUse(name: string, input: { url: string }): Promise<string> {
  if (name === "fetch_paid_resource") {
    const response = await x402Fetch(input.url);
    return response.text();
  }
  throw new Error(`Unknown tool: ${name}`);
}

// In your chat loop:
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  tools,
  messages: [{ role: "user", content: "Get the premium data from https://api.example.com/premium" }],
});

for (const block of response.content) {
  if (block.type === "tool_use") {
    const result = await handleToolUse(block.name, block.input as { url: string });
    // Continue conversation with tool result...
  }
}
```

### Generic Agent Pattern

For custom agent implementations or other frameworks:

```typescript
import { createX402Client } from "./x402-client.js";

// 1. Initialize once at startup
const { x402Fetch } = await createX402Client({
  apiPublicKey: process.env.API_PUBLIC_KEY!,
  apiPrivateKey: process.env.API_PRIVATE_KEY!,
  organizationId: process.env.ORGANIZATION_ID!,
});

// 2. Define your tool interface
interface AgentTool {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>) => Promise<string>;
}

const paidFetchTool: AgentTool = {
  name: "fetch_paid_resource",
  description: "Fetch data from a URL, automatically paying if required",
  execute: async (params) => {
    const response = await x402Fetch(params.url as string);
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.text();
  },
};

// 3. Wire into your agent loop
async function agentLoop(task: string) {
  const tools = [paidFetchTool];
  
  while (true) {
    const action = await yourLLM.decide(task, tools);
    
    if (action.type === "tool_call") {
      const tool = tools.find(t => t.name === action.tool);
      const result = await tool!.execute(action.params);
      // Feed result back to LLM...
    } else if (action.type === "done") {
      return action.response;
    }
  }
}
```

## Troubleshooting

**`Missing required environment variables`**

- Ensure `API_PUBLIC_KEY`, `API_PRIVATE_KEY`, and `ORGANIZATION_ID` are set in `.env.local`.

**`fetch failed` / `ENOTFOUND api.turnkey.com`**

- Check internet/DNS and verify `BASE_URL`.

**`Payment failed (402)`**

- Check wallet USDC balance and network alignment (`SOLANA_RPC_URL` vs paywall endpoint).

**`No compatible Solana payment requirements found`**

- Required network/asset does not match your configured RPC network or expected mint.

**`bigint: Failed to load bindings`**

- Rebuild native binding:
  - `pnpm --filter @turnkey/example-with-x402-faremeter rebuild bigint-buffer`

## Security Considerations

When deploying agent payment flows:

1. Never commit API keys.
2. Use sub-organizations to isolate agent risk.
3. Apply [Turnkey policies](https://docs.turnkey.com/concepts/policies) for spending limits.
4. Monitor wallet and payment activity.
5. Rotate API keys regularly.

## Related Examples

- [`with-solana`](../with-solana/) - Interactive Solana signing demo

## Resources

- [Turnkey Documentation](https://docs.turnkey.com/)
- [Faremeter GitHub](https://github.com/faremeter/faremeter)
- [Faremeter Documentation](https://docs.corbits.dev/faremeter/overview)
- [x402 Protocol](https://github.com/coinbase/x402)
- [x402 Echo Server](https://x402.payai.network/)
- [Circle Faucet](https://faucet.circle.com/)
- [Solana Faucet](https://faucet.solana.com/)
