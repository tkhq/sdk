# with-agent-wallet

This example demonstrates the **agentic wallets** pattern for [Turnkey embedded wallets](https://docs.turnkey.com/products/embedded-wallets/features/agentic-wallets): each user owns a sub-org with an embedded Ethereum wallet, and an AI agent is granted scoped signing rights over that wallet via policy. The agent signs transactions autonomously within its policy bounds — no root key exposure, no shared custody.

The core mechanic is **policy-gated signing**. A non-root agent user is created inside the user's sub-org and given a P-256 API key. Three policies control what the agent can do:

| Scenario      | Destination / Action | Policy                         | Outcome                                                     |
| ------------- | -------------------- | ------------------------------ | ----------------------------------------------------------- |
| `allowed`     | `ALLOWED_RECIPIENT`  | Agent alone (1-of-1 consensus) | Completes immediately                                       |
| `approval`    | `APPROVAL_RECIPIENT` | Agent + human (explicit IDs)   | Sits in `CONSENSUS_NEEDED` until you approve in the browser |
| `denied`      | Any other address    | No matching ALLOW policy       | Rejected outright                                           |
| `self-delete` | Delete own user      | Agent alone (1-of-1 consensus) | Agent can remove itself if compromised                      |

The dashboard listens for webhook events via **SSE** and shows an **Approve** button for pending activities.

## How it works

```
Browser (user)            Next.js server            Turnkey                 Terminal (agent CLI)
──────────────            ──────────────            ───────                 ───────────────────
Login via Auth Proxy ─────────────────────────────────────────►
                          Creates sub-org + embedded wallet
◄──────────── session (orgId, walletAddress) ─────────────────

Setup tab: "Setup agent" ─────────────────────────────────────►
                          (client session key) creates agent user
                          Creates Policy A (free signing)
                          Creates Policy B (agent + human, explicit IDs)
                          Creates Policy C (self-delete)
◄──────────── agentUserId, policyIds (A / B / C) ─────────────

                                                                            pnpm agent allowed <addr> <orgId>
                                                                            ethSendTransaction ─────────────►
                                                                                              COMPLETED
                                                                            Fires webhook ◄──────────────────
                          POST /api/webhook/activity-updates
                          addEvent to SSE store
GET /api/events (SSE) ◄── activity-update (COMPLETED)

                                                                            pnpm agent approval <addr> <orgId>
                                                                            ethSendTransaction ─────────────►
                                                                                              CONSENSUS_NEEDED
                                                                            Fires webhook ◄──────────────────
                          addEvent to SSE store
GET /api/events (SSE) ◄── activity-update (CONSENSUS_NEEDED)
[Approve] button

httpClient.approveActivity ───────────────────────────────────►
                                                                                              COMPLETED
                                                                            Fires webhook ◄──────────────────
GET /api/events (SSE) ◄── activity-update (COMPLETED)
```

## Prerequisites

- Node.js 20+
- A [Turnkey](https://app.turnkey.com) account with:
  - A parent org
  - An [Auth Proxy](https://docs.turnkey.com/authentication/auth-proxy) config (for embedded wallet creation on sign-up)
  - An admin API key pair (`API_PUBLIC_KEY` / `API_PRIVATE_KEY`) — used only for webhook registration (`pnpm webhook`)
  - A **separate** P-256 agent API key pair (`AGENT_API_PUBLIC_KEY` / `AGENT_API_PRIVATE_KEY`) — registered as a non-root user in the sub-org at setup time by the user's own session key
- [ngrok](https://ngrok.com) (or any public tunnel) for local webhook delivery

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Generate an agent API key pair

The agent key is a standard P-256 key pair. Generate one with the [Turnkey CLI](https://docs.turnkey.com/sdks/cli):

```bash
turnkey generate api-key --key-name agent-key
```

Note the public key and private key — you'll need both in `.env.local`.

### 3. Start ngrok

In a separate terminal:

```bash
ngrok http 3000
```

Copy the `https://...ngrok-free.app` URL — you'll need it in the next step.

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable                           | Description                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_ORGANIZATION_ID`      | Your parent org ID                                                                                                 |
| `NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID` | Your Auth Proxy config ID                                                                                          |
| `NEXT_PUBLIC_AGENT_API_PUBLIC_KEY` | Agent P-256 public key (66 hex chars, no `0x`) — registered in the sub-org by the user's session key at setup time |
| `AGENT_API_PRIVATE_KEY`            | Agent P-256 private key — used by `pnpm agent` to stamp signing requests                                           |
| `API_PUBLIC_KEY`                   | Admin API key public — used only by `pnpm webhook` to register webhook endpoints                                   |
| `API_PRIVATE_KEY`                  | Admin API key private                                                                                              |
| `NEXT_PUBLIC_ALLOWED_RECIPIENT`    | Sepolia address the agent can sign to freely (Policy A)                                                            |
| `NEXT_PUBLIC_APPROVAL_RECIPIENT`   | Sepolia address that requires your approval (Policy B)                                                             |
| `WEBHOOK_URL`                      | `https://<your-ngrok-id>.ngrok-free.app/api/webhook/activity-updates`                                              |

### 5. Register the webhook

```bash
pnpm webhook -register
```

This creates a webhook endpoint on your parent org subscribed to `ACTIVITY_UPDATES`. A single registration covers all sub-orgs — no per-user setup needed.

If ngrok restarts and gives you a new URL, you can either re-run `-register` to create a new endpoint, or update the existing one — update `WEBHOOK_URL` in `.env.local` and run:

```bash
pnpm webhook -update
```

### 6. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Walkthrough

1. **Sign up / sign in** — click "Login / Sign Up". Auth Proxy creates a sub-org with an embedded Ethereum wallet on first login.
2. **Setup tab** — click "Setup agent". Your browser session key creates a non-root agent user (with your `AGENT_API_PUBLIC_KEY`) and three signing policies directly in your sub-org — no admin key involved. The page shows the resulting IDs and pre-filled CLI commands.
3. **Test tab** — four copy-paste CLI commands are shown with your actual wallet address and sub-org ID:
   - **Allowed**: `pnpm agent allowed <address> <orgId>` — agent signs to `ALLOWED_RECIPIENT`, activity completes immediately.
   - **Approval**: `pnpm agent approval <address> <orgId>` — agent signs to `APPROVAL_RECIPIENT`, activity lands in `CONSENSUS_NEEDED`. An **Approve** button appears in the event log — click it to submit vote 2 with your session key.
   - **Denied**: `pnpm agent denied <address> <orgId>` — agent tries to sign to an unknown address, rejected by default-deny.
   - **Self-delete**: `pnpm agent self-delete <address> <orgId>` — agent calls `deleteUsers` on its own user ID (Policy C). Run after testing or to simulate key-compromise self-remediation.

All three scenarios deliver webhook events that appear in the live SSE activity log.

## Project structure

```
src/
├── app/
│   ├── page.tsx                              # Login page
│   ├── providers.tsx                         # TurnkeyProvider with Auth Proxy config
│   ├── dashboard/
│   │   ├── layout.tsx                        # Tab nav (Setup / Test)
│   │   ├── setup/page.tsx                    # Agent setup: create user + policies
│   │   └── test/page.tsx                     # CLI commands + SSE activity log + Approve
│   └── api/
│       ├── webhook/activity-updates/route.ts # Webhook receiver
│       └── events/route.ts                   # SSE stream
├── lib/
│   ├── types.ts                              # Webhook / SSE types
│   └── activity-events.ts                    # In-memory event store
└── scripts/
    ├── agent.ts                              # CLI: submit a tx as the agent
    └── webhook.ts                            # CLI: pnpm webhook -register / -update
```

## How SSE works in this example

The browser opens a persistent `GET /api/events` connection via the browser's built-in `EventSource` API. The server keeps that response open and pushes `data: ...\n\n` chunks when webhook events arrive — no polling needed. On connect, the server replays the last 50 events so a freshly loaded browser still sees recent activity.

The glue is an in-memory `ActivityEventStore` singleton (stored on `globalThis` to survive Next.js hot-reloads). When Turnkey POSTs to `/api/webhook/activity-updates`, `store.addEvent()` fires a Node.js `EventEmitter`. The SSE handler has a listener registered, so the event is immediately written into the open response stream.

**Limitation:** this requires the webhook POST and the SSE GET to land on the **same Node.js process**. In production, replace the in-memory store with a pub/sub layer (Redis, Postgres `LISTEN/NOTIFY`, etc.).

## Policy design

See [policy evaluation](https://docs.turnkey.com/concepts/policies/overview#policy-evaluation) for how Turnkey resolves multiple policies. The three policies created by "Setup agent":

**Policy A — free signing:**

```
condition:  eth.tx.to == '<ALLOWED_RECIPIENT>'
consensus:  approvers.any(user, user.id == '<agentUserId>')
effect:     ALLOW
```

The agent submitting the activity counts as one vote and satisfies the consensus immediately.

**Policy B — approval required:**

```
condition:  eth.tx.to == '<APPROVAL_RECIPIENT>'
consensus:  approvers.any(user, user.id == '<agentUserId>')
            && approvers.any(user, user.id == '<humanUserId>')
effect:     ALLOW
```

Both the agent and the specific human who ran setup must approve. The agent's submission is vote 1; the activity sits in `CONSENSUS_NEEDED` until the human clicks Approve (vote 2).

**Policy C — self-delete:**

```
condition:  activity.type == 'ACTIVITY_TYPE_DELETE_USERS'
            && activity.params.user_ids.count() == 1
            && '<agentUserId>' in activity.params.user_ids
consensus:  approvers.any(user, user.id == '<agentUserId>')
effect:     ALLOW
```

The agent can delete only itself (the condition enforces a single-user deletion scoped to its own ID). This enables fast self-remediation if the agent key is compromised — no manual intervention required.

## Notes

- The agent API key (`AGENT_API_PRIVATE_KEY`) and the admin key (`API_PRIVATE_KEY`) are intentionally separate — the agent key can only sign transactions that match a policy; it cannot manage users or policies.
- `fetchOrCreateP256ApiKeyUser` and `fetchOrCreatePolicies` are idempotent — re-running setup reuses existing resources matched by public key and policy name.
- Transactions use Gas Station sponsorship (`sponsor: true`) on Sepolia — gas is covered, but the wallet needs a small Sepolia ETH balance for the 0.01 ETH value sent in each transaction.
- The in-memory event store resets on server restart. For production use, persist events to a database.
