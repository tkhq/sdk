# with-cosigning

Demonstrates [co-signing transactions](https://docs.turnkey.com/company-wallets/co-signing-transactions) with Turnkey using a **2-of-2 root quorum**.

- **User** authenticates via email OTP and signs a message with their session key (vote 1 of 2).
- **Backend cosigner** receives an `ACTIVITY_UPDATES` webhook and logs a ready-to-run `pnpm cosign` command. Running it submits vote 2 of 2 via the cosigner API key.
- The frontend listens via **SSE** (Server-Sent Events — a browser API that keeps an HTTP connection open so the server can push updates without polling) and shows the final signature when the activity completes.

## How it works

```
User (browser)          Backend (Next.js)       Turnkey         Terminal (operator)
──────────────          ─────────────────       ───────         ───────────────────
Sign message  ─────────────────────────────►  Creates activity
                                              status: CONSENSUS_NEEDED
              ◄────── activity.id, org.id ──
              (polls 3x, returns CONSENSUS_NEEDED)
Show "run pnpm cosign …"

                                              Fires webhook ──────────►
                        POST /api/webhook/activity-updates
                        logs: "run pnpm cosign …"
                        addEvent to SSE store

                                                              pnpm cosign <id> <orgId>
                                                              approveActivity ────────►
                                              status: COMPLETED
                                              Fires webhook ──────────►
                        addEvent to SSE store

GET /api/events (SSE) ◄── activity-update event (COMPLETED)
Show signature
```

## Prerequisites

- Node.js 18+
- A [Turnkey](https://app.turnkey.com) account with a parent org and **two API key pairs**: one admin key (`API_PUBLIC_KEY` / `API_PRIVATE_KEY`) and one cosigner key (`COSIGNER_API_PUBLIC_KEY` / `COSIGNER_API_PRIVATE_KEY`)
- [ngrok](https://ngrok.com) (or any public tunnel) for local webhook delivery

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start ngrok

In a separate terminal:

```bash
npx ngrok http 3000
```

Copy the `https://...ngrok-free.app` URL — you'll need it in the next step.

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable                      | Description                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_BASE_URL`        | Turnkey API base URL (`https://api.turnkey.com`)                                     |
| `NEXT_PUBLIC_ORGANIZATION_ID` | Your parent org ID                                                                   |
| `API_PUBLIC_KEY`              | Admin API key public — used for OTP flow and sub-org creation                        |
| `API_PRIVATE_KEY`             | Admin API key private                                                                |
| `COSIGNER_API_PUBLIC_KEY`     | Cosigner API key public — embedded in every sub-org at creation time as a root user  |
| `COSIGNER_API_PRIVATE_KEY`    | Cosigner API key private — used by `pnpm cosign` to stamp the `approveActivity` call |
| `WEBHOOK_URL`                 | Set to `https://<your-ngrok-id>.ngrok-free.app/api/webhook/activity-updates`         |

### 4. Register the webhook

This script creates a webhook endpoint on your parent org subscribed to `ACTIVITY_UPDATES`. Turnkey delivers webhook events for all sub-org activity to the parent org's registered webhooks, so a single registration covers every sub-org created under it — no per-sub-org setup needed.

```bash
pnpm webhook -register
```

If ngrok restarts and gives you a new URL, you can either re-run `-register` to create a new endpoint, or update the existing one — update `WEBHOOK_URL` in `.env.local` and run:

```bash
pnpm webhook -update
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Flow walkthrough

1. **Sign up / sign in** — Enter your email, receive a one-time code, verify it.
2. **First sign-in** — A sub-org is created with a 2-of-2 root quorum:
   - Root user 1: you (authenticated via OTP session key)
   - Root user 2: the backend cosigner (authenticated via `COSIGNER_API_PUBLIC_KEY`)
3. **Sign a message** — Click "Sign message" on the dashboard.
   - Your session key submits vote 1; the activity reaches `CONSENSUS_NEEDED`.
   - The dashboard shows a ready-to-run command with the activity ID and sub-org ID.
   - The webhook fires and logs the same command to the server console.
4. **Approve as cosigner** — In a second terminal, run the command shown on the dashboard:
   ```bash
   pnpm cosign <activityId> <subOrgId>
   ```
   This uses `COSIGNER_API_PRIVATE_KEY` to stamp the approval request.
5. **See the signature** — The SSE stream notifies the dashboard; the final ECDSA signature appears.

## Project structure

```
src/
├── app/
│   ├── page.tsx                              # Email OTP login
│   ├── dashboard/page.tsx                    # Sign + SSE activity log
│   └── api/
│       ├── webhook/activity-updates/route.ts # Webhook receiver + cosign prompt
│       └── events/route.ts                   # SSE stream
├── server/actions/turnkey.ts                 # OTP flow + 2-of-2 sub-org creation
├── lib/
│   ├── types.ts                              # Webhook / SSE types
│   └── activity-events.ts                    # In-memory event store
└── scripts/
    ├── cosign.ts                             # CLI: approve a pending activity as cosigner
    └── webhook.ts                            # CLI: pnpm webhook -register / -update
```

## How SSE works in this example

The browser opens a persistent `GET /api/events` connection using the browser's built-in `EventSource` API. The server keeps that HTTP response open and writes `data: ...\n\n` chunks whenever a new webhook event arrives — no polling needed.

The glue between the webhook handler and the open browser connection is an in-memory `ActivityEventStore` singleton (stored on `globalThis` so it survives Next.js hot-reloads). When Turnkey POSTs a webhook to `/api/webhook/activity-updates`, the handler calls `store.addEvent()`, which fires a Node.js `EventEmitter`. The SSE handler registered a listener on that emitter when the browser connected, so the event is immediately written into the open response stream and the browser receives it.

On connect, the server also replays the last 50 events so a browser that joins after an activity was already approved still sees the result.

**Limitation:** this relies on the webhook POST and the SSE GET being handled by the **same Node.js process**. That holds for a single-server dev setup but breaks under horizontal scaling or serverless deployments where each request may land on a different instance. In production, replace the in-memory store with a pub/sub layer (Redis, Postgres LISTEN/NOTIFY, etc.).

## Notes

- In production the cosigner role would be a background service or a human-in-the-loop approval workflow — `pnpm cosign` simulates that as a manual operator step.
- The in-memory event store is reset on server restart. For production use, persist events to a database.
- `COSIGNER_API_PUBLIC_KEY` is embedded in each sub-org at creation time as a root user. Rotating the cosigner key requires updating every existing sub-org.
- The admin key (`API_PUBLIC_KEY`) and the cosigner key (`COSIGNER_API_PUBLIC_KEY`) are intentionally separate: a compromised admin key cannot approve transactions, and a compromised cosigner key cannot manage users or create sub-orgs.
