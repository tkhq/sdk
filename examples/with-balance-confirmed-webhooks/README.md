# Example: `with-balance-confirmed-webhooks`

This example includes:

- a script that creates a webhook endpoint for `BALANCE_CONFIRMED_UPDATES` using `@turnkey/sdk-server`
- a webhook server endpoint at `/webhook/balance-updates`
- a frontend that fetches balances for an address (`getWalletAddressBalances`, surfaced as `getBalances` in this example)
- a frontend popup notification when a balance-confirmed webhook arrives
- per-asset send buttons in the balances table so you can send native assets, ERC-20 tokens, or SPL tokens (`sponsor: false`) to a prompted recipient address

## Getting started

### 1/ Install dependencies

From the repository root:

```bash
corepack enable
pnpm install
```

### 2/ Configure environment variables

From this example directory:

```bash
cd examples/with-balance-confirmed-webhooks
cp .env.example .env
```

Fill in:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `ORGANIZATION_ID`
- `WEBHOOK_URL` (public URL that points to `/webhook/balance-updates`)
- `NEXT_PUBLIC_DEFAULT_ADDRESS` should be an address controlled by your Turnkey org if you want to test withdrawals from the UI
  (it must have enough native balance on the selected network to cover value + fees, and for SPL sends it also needs enough SOL to create the recipient ATA when missing)
- optional `ETH_RPC_URL` if you want to force a specific RPC endpoint for unsponsored ETH sends
- optional `SOLANA_RPC_URL` if you want to force a specific RPC endpoint for unsponsored Solana sends

Example:

```env
WEBHOOK_URL="https://your-subdomain.ngrok-free.app/webhook/balance-updates"
```

### 3/ Run the app

```bash
pnpm dev
```

The app runs at `http://localhost:3000`.

### 4/ Expose localhost for webhook delivery

Use ngrok (or equivalent):

```bash
ngrok http 3000
```

Update `WEBHOOK_URL` in `.env` to match your ngrok URL and keep the `/webhook/balance-updates` path.

### 5/ Register the webhook with Turnkey (via SDK server)

```bash
pnpm register-webhook
```

This script calls:

- `createWebhookEndpoint`
- with subscription `{ eventType: "BALANCE_CONFIRMED_UPDATES" }`

## Webhook endpoint details

- Endpoint: `POST /webhook/balance-updates`
- SSE stream to frontend: `GET /api/events`
- Balance lookup API used by frontend: `GET /api/balances?address=<address>&caip2=<caip2>`
- Transaction send API used by table action buttons: `POST /api/tx-send` (always sends with `sponsor: false`)

## Test webhook delivery locally

You can simulate a webhook event:

```bash
curl -X POST http://localhost:3000/webhook/balance-updates \
  -H "content-type: application/json" \
  -d '{
    "type": "balances:confirmed",
    "msg": {
      "operation": "withdraw",
      "caip2": "eip155:8453",
      "txHash": "0xa1f7f464f73cdf484daf24e59932baefbb71fadf6590f22dc50750a0809cbcdc",
      "address": "0x527602f07b0a70ed2be48f55e2678bbf4ef57df3",
      "orgID": "ac4763ff-4bb3-4350-b926-355d87882578",
      "parentOrgID": "1875b49b-22ad-42c6-949f-04d5dd03ee3a",
      "idempotencyKey": "8be5a6fa9d04d9474b41e659e5b9b0c4b8eaa5fba754b4154fb8f29b3b20ac9e",
      "asset": {
        "symbol": "USDC",
        "name": "USDC",
        "decimals": 6,
        "caip19": "eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "amount": "1000000"
      },
      "block": {
        "number": 44442259,
        "hash": "0x3cbf7799ed6ebe18549440898877720e2e1c5fb914d10e949c449f26be2f58eb",
        "timestamp": "2026-04-08T18:44:25Z"
      }
    }
  }'
```

When this request is received, the frontend shows a popup notification and appends the event to the recent events list.

## Triggering a withdrawal event from UI

1. Set the sender address in the UI to an address you control in Turnkey.
2. Set network to either an EVM CAIP-2 value (for example `eip155:8453`) or a Solana CAIP-2 value (for example `solana:mainnet`).
3. Click the per-asset send button in the balances table (`Send <asset> (Native)`, `Send <asset> (ERC20)`, or `Send <asset> (SPL)`).
4. Enter recipient address and amount in the popup prompts.

If the send is accepted and your webhook subscription is active, the resulting withdrawal event should appear under recent webhook events and the balances table will auto-refresh.

Withdrawal sends from this demo only succeed when the sender address (typically your `NEXT_PUBLIC_DEFAULT_ADDRESS` from `.env`) has sufficient native asset balance for both transfer amount and gas fees.

## Notes

- This is an example implementation with in-memory event storage for live UI updates.
- Restarting the Next.js process clears event history.
- Signature verification is not implemented in this demo endpoint; add verification before production use.
- This demo uses unsponsored sends (`sponsor: false`) for both EVM and Solana, but the same webhook/event-driven balance update pattern also works for sponsorship flows for customers that have them enabled with Turnkey.
