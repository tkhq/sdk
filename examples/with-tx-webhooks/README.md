# Example: `with-tx-webhooks`

This example demonstrates Turnkey webhook subscriptions for two event types:

- **`BALANCE_CONFIRMED_UPDATES`** — fires when a balance change is confirmed on-chain
- **`SEND_TRANSACTION_STATUS_UPDATES`** — fires when a sponsored transaction status changes

It includes:

- a script that registers a webhook endpoint for either event type using `@turnkey/sdk-server`
- webhook server endpoints at `/webhook/balance-updates` and `/webhook/tx-updates`
- a frontend that fetches balances for an address (`getWalletAddressBalances`, surfaced as `getBalances` in this example)
- a frontend popup notification when a webhook event arrives
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
cd examples/with-tx-webhooks
cp .env.example .env
```

Fill in:

- `API_PUBLIC_KEY`
- `API_PRIVATE_KEY`
- `ORGANIZATION_ID`
- `BALANCE_WEBHOOK_URL` (public URL that points to `/webhook/balance-updates`)
- `TX_STATUS_WEBHOOK_URL` (public URL that points to `/webhook/tx-updates`)
- `NEXT_PUBLIC_DEFAULT_ADDRESS` should be an address controlled by your Turnkey org if you want to test withdrawals from the UI
  (it must have enough native balance on the selected network to cover value + fees, and for SPL sends it also needs enough SOL to create the recipient ATA when missing)
- optional `ETH_RPC_URL` if you want to force a specific RPC endpoint for unsponsored ETH sends
- optional `SOLANA_RPC_URL` if you want to force a specific RPC endpoint for unsponsored Solana sends

Example:

```env
BALANCE_WEBHOOK_URL="https://your-subdomain.ngrok-free.app/webhook/balance-updates"
TX_STATUS_WEBHOOK_URL="https://your-subdomain.ngrok-free.app/webhook/tx-updates"
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

Update `BALANCE_WEBHOOK_URL` and `TX_STATUS_WEBHOOK_URL` in `.env` to match your ngrok URL.

### 5/ Register the webhook with Turnkey (via SDK server)

Register a **balance-confirmed** webhook:

```bash
pnpm register-webhook:balance
```

Register a **transaction status** webhook:

```bash
pnpm register-webhook:tx-status
```

Both commands call `createWebhookEndpoint` and set the appropriate `eventType` subscription. You can register both at the same time — each call creates a separate endpoint.

## Webhook endpoint details

| Purpose                                            | Route                                               |
| -------------------------------------------------- | --------------------------------------------------- |
| Receive `BALANCE_CONFIRMED_UPDATES` webhooks       | `POST /webhook/balance-updates`                     |
| Receive `SEND_TRANSACTION_STATUS_UPDATES` webhooks | `POST /webhook/tx-updates`                          |
| SSE stream for balance events (frontend)           | `GET /api/balance-events`                           |
| SSE stream for tx-status events (frontend)         | `GET /api/tx-events`                                |
| Balance lookup                                     | `GET /api/balances?address=<address>&caip2=<caip2>` |
| Send transaction (unsponsored)                     | `POST /api/tx-send`                                 |

## Test webhook delivery locally

Simulate a **balance confirmed** event:

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

Simulate a **transaction status** event:

```bash
curl -X POST http://localhost:3000/webhook/tx-updates \
  -H "content-type: application/json" \
  -d '{
    "type": "transaction:status",
    "msg": {
      "sendTransactionStatusId": "abc123",
      "activityId": "activity-456",
      "orgID": "ac4763ff-4bb3-4350-b926-355d87882578",
      "status": "CONFIRMED",
      "caip2": "eip155:8453",
      "idempotencyKey": "8be5a6fa9d04d9474b41e659e5b9b0c4b8eaa5fba754b4154fb8f29b3b20ac9e",
      "timestamp": 1746000000,
      "txHash": "0xa1f7f464f73cdf484daf24e59932baefbb71fadf6590f22dc50750a0809cbcdc"
    }
  }'
```

When either request is received, the frontend shows a popup notification and appends the event to the corresponding feed.

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
