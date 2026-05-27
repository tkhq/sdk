# Example: `with-balance-webhooks`

This example includes:

- a script that creates a webhook endpoint subscribed to **both** `BALANCE_CONFIRMED_UPDATES` and `BALANCE_FINALIZED_UPDATES` using `@turnkey/sdk-server`
- a single webhook server endpoint at `/webhook/balance-updates` that accepts both lifecycle events
- a frontend that fetches balances for an address (`getWalletAddressBalances`, surfaced as `getBalances` in this example)
- a frontend popup notification when a balance webhook arrives (confirmed or finalized)
- per-asset send buttons in the balances table so you can send native assets, ERC-20 tokens, or SPL tokens (`sponsor: false`) to a prompted recipient address

### Confirmed vs finalized

Both subscriptions use the same URL and the same `msg` shape. They differ by **when** Turnkey emits them relative to on-chain depth:

| Subscription | Webhook `type` | When it fires |
| --- | --- | --- |
| `BALANCE_CONFIRMED_UPDATES` | `balances:confirmed` | Balance change reached Turnkey’s **confirmation** depth for the network |
| `BALANCE_FINALIZED_UPDATES` | `balances:finalized` | Balance change reached Turnkey’s **finalization** threshold for the network |

A single on-chain transfer can produce **two** UI events (confirmed first, then finalized). That is intentional in this demo so you can see both lifecycle stages.

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
cd examples/with-balance-webhooks
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

This script calls `createWebhookEndpoint` with **both** subscriptions on one endpoint:

- `{ eventType: "BALANCE_CONFIRMED_UPDATES" }`
- `{ eventType: "BALANCE_FINALIZED_UPDATES" }`

#### Re-registering if you already have a confirmed-only endpoint

`updateWebhookEndpoint` in this repo only supports `url`, `name`, and `isActive`—not subscriptions. If you registered earlier with only `BALANCE_CONFIRMED_UPDATES`, run `pnpm register-webhook` again to create a new endpoint with both subscriptions, then deactivate or delete the old endpoint in the Turnkey dashboard if you no longer need it.

## Webhook endpoint details

- Endpoint: `POST /webhook/balance-updates`
- SSE stream to frontend: `GET /api/events`
- Balance lookup API used by frontend: `GET /api/balances?address=<address>&caip2=<caip2>`
- Transaction send API used by table action buttons: `POST /api/tx-send` (always sends with `sponsor: false`)

## Test webhook delivery locally

With `pnpm dev` running, you can simulate either lifecycle event.

**Confirmed** (`balances:confirmed`):

```bash
curl -X POST http://localhost:3000/webhook/balance-updates \
  -H "content-type: application/json" \
  -d '{
    "type": "balances:confirmed",
    "organizationId": "95dfcd47-99bb-4433-9126-1524110d68e6",
    "parentOrganizationId": "95dfcd47-99bb-4433-9126-1524110d68e6",
    "msg": {
      "operation": "deposit",
      "caip2": "eip155:8453",
      "txHash": "0x5b6901be92e69781a7ce401dd9a2910e1f49aa77a5bdedcd2a23c8d563d88b24",
      "address": "0x3400e577153101863f39ba41f7fd49bbea011628",
      "idempotencyKey": "d3b8cef0ad7479433783c5707da9ded4fee9b254b4638f44758a2141c49416b7:balances:confirmed",
      "asset": {
        "symbol": "ETH",
        "name": "Ethereum",
        "decimals": 18,
        "caip19": "eip155:8453/slip44:60",
        "amount": "4793760441409"
      },
      "block": {
        "number": 46343814,
        "hash": "0x41a4e8d444e5410f83c1ac35c838c7d8be1e3d6f32a35a04c72096adae74d095",
        "timestamp": "2026-05-22T19:09:35Z"
      }
    }
  }'
```

**Finalized** (`balances:finalized`):

```bash
curl -X POST http://localhost:3000/webhook/balance-updates \
  -H "content-type: application/json" \
  -d '{
    "type": "balances:finalized",
    "organizationId": "95dfcd47-99bb-4433-9126-1524110d68e6",
    "parentOrganizationId": "95dfcd47-99bb-4433-9126-1524110d68e6",
    "msg": {
      "operation": "deposit",
      "caip2": "eip155:8453",
      "txHash": "0x5b6901be92e69781a7ce401dd9a2910e1f49aa77a5bdedcd2a23c8d563d88b24",
      "address": "0x3400e577153101863f39ba41f7fd49bbea011628",
      "idempotencyKey": "d3b8cef0ad7479433783c5707da9ded4fee9b254b4638f44758a2141c49416b7:balances:finalized",
      "asset": {
        "symbol": "ETH",
        "name": "Ethereum",
        "decimals": 18,
        "caip19": "eip155:8453/slip44:60",
        "amount": "4793760441409"
      },
      "block": {
        "number": 46343814,
        "hash": "0x41a4e8d444e5410f83c1ac35c838c7d8be1e3d6f32a35a04c72096adae74d095",
        "timestamp": "2026-05-22T19:09:35Z"
      }
    }
  }'
```

When either request is received, the frontend shows a phase-specific popup notification (`[Confirmed]` or `[Finalized]`), appends the event to the recent events list with a matching badge, and refreshes balances when the webhook address/network match the UI.

## Triggering withdrawal events from the UI

1. Set the sender address in the UI to an address you control in Turnkey.
2. Set network to either an EVM CAIP-2 value (for example `eip155:8453`) or a Solana CAIP-2 value (for example `solana:mainnet`).
3. Click the per-asset send button in the balances table (`Send <asset> (Native)`, `Send <asset> (ERC20)`, or `Send <asset> (SPL)`).
4. Enter recipient address and amount in the popup prompts.

If the send is accepted and your webhook subscriptions are active, you may see **two** events for the same transfer (confirmed, then finalized). Both appear under recent webhook events and the balances table auto-refreshes on each.

Withdrawal sends from this demo only succeed when the sender address (typically your `NEXT_PUBLIC_DEFAULT_ADDRESS` from `.env`) has sufficient native asset balance for both transfer amount and gas fees.

## Notes

- This is an example implementation with in-memory event storage for live UI updates.
- Restarting the Next.js process clears event history.
- Signature verification is not implemented in this demo endpoint; add verification before production use.
- This demo uses unsponsored sends (`sponsor: false`) for both EVM and Solana, but the same webhook/event-driven balance update pattern also works for sponsorship flows for customers that have them enabled with Turnkey.
