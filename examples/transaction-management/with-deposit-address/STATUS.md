# Status

## Decisions from section 4 of the scope

**1. Where does the delegated key live?** In a server-side env var,
`TURNKEY_DA_PRIVATE_KEY`, as in `with-delegated/client-side`. Only API routes
and the scripts read it. The public half is `NEXT_PUBLIC_DA_PUBLIC_KEY`,
because the browser needs it to create the delegated user from the user's
session. The base example kept the public key in two variables; this one uses
one, since a public key is not secret.

**2. ERC-20 policy condition.** `eth.tx.function_name` and
`eth.tx.contract_call_args` are populated only when the contract's ABI has
been uploaded as a smart contract interface
(`/features/policies/smart-contract-interfaces`, `/features/policies/language`).
The docs do not say whether a parent-org upload applies to sub-orgs, and
uploading per user adds an object to every sub-org. **Fallback chosen:** the raw
calldata check the Ethereum policy examples give for this case, extended to pin
the recipient:

```
eth.tx.to == '<treasury>' ||
(eth.tx.to == '<usdc>' && eth.tx.data[0..10] == '0xa9059cbb' &&
 eth.tx.data[34..74] == '<treasury without 0x>')
```

All addresses are lowercase, following `with-agent-wallet`, which uses
lowercase `eth.tx.to` conditions with sponsored `ethSendTransaction`. The
policy does not pin the chain (`eth.tx.chain_id`), because the docs do not say
it is populated for sponsored `ETH_SEND_TRANSACTION_V2` activities. The key can
only ever pay the treasury, on any chain.

**3. Gas sponsorship on Base Sepolia.** Base Sepolia (`eip155:84532`) is on the
sponsored-chain list in `/features/transaction-management/broadcasting`.
Whether a given org has Gas Sponsorship turned on is a dashboard setting the
docs cannot answer. **Fallback chosen:** the sweep always sends with
`sponsor: true` and fails closed. If sponsorship is off, the send fails, the
server logs the error, the UI shows the sweep as failed, and nothing is
retried. The README lists this under common failures.

**4. Webhook signature verification.** Answered by
`/features/webhooks/verify-signatures`. Keys come from the public JWKS at
`https://api.turnkey.com/public/v1/discovery/webhooks/jwks`, matched on `kid`
against `X-Turnkey-Signature-Key-Id`. The signed input is
`v1.ed25519.<key_id>.<timestamp_ms>.<event_id>.<raw_body>`, and the headers
are `X-Turnkey-Timestamp`, `X-Turnkey-Event-Id`,
`X-Turnkey-Signature-Algorithm`, `X-Turnkey-Signature-Version` and
`X-Turnkey-Signature`. `verifyTurnkeyWebhookSignature` from `@turnkey/crypto`
does the check and returns the verified event id, which is the de-duplication
key (`X-Turnkey-Event-Id` is stable across retries).

## Progress

| Day | Slice                                        | Code | Checked live |
| --- | -------------------------------------------- | ---- | ------------ |
| 1   | Copy base, enable button, policy, QR code    | Done | No           |
| 2   | Webhook registration, verified webhook route | Done | No           |
| 3   | Sponsored sweep, de-duplication              | Done | No           |
| 4   | User-signed withdraw, `pnpm validate`        | Done | No           |
| 5   | README, PR                                   | Done | n/a          |

`pnpm typecheck`, prettier and `next build` are clean. Nothing has been run
against live Turnkey or Base Sepolia yet; see Blocked.

## What is built, and how it was checked

- **Enable.** "Enable deposit address" creates the delegated user
  (`fetchOrCreateP256ApiKeyUser`) and its one policy (`fetchOrCreatePolicies`),
  both stamped by the user's session. `createUsers` never touches the root
  quorum (read in `packages/core/src/__clients__/core.ts`). The dashboard
  shows the address and a QR code and checks live that the user is the sole
  root, the delegated user is not root, and there is exactly one policy.
  _Checked: typecheck and build only._
- **Registration.** Before recording an address, the server confirms with the
  delegated key that the key's user is in the sub-org, is not root, and owns
  the address. _Checked: typecheck only._
- **Webhook.** `pnpm register-webhook` subscribes the parent org's
  `BALANCE_CONFIRMED_UPDATES`, reusing an existing subscription. The route
  verifies the signature against the JWKS, drops repeated event ids, and maps
  the address to its sub-org. _Checked offline_ with a local JWKS and
  Ed25519-signed deliveries: valid (200, logged with sub-org), repeated event
  id (ignored), tampered body (401), stale timestamp (401), unsigned (401),
  unknown address (ignored), sub-org mismatch (ignored, not swept).
- **Sweep.** Reads the balance, then sends all of it to the treasury from the
  deposit address with `sponsor: true`, signed by the delegated key. Sweeps
  per address run in order; failures are logged and never retried. _Checked
  offline_ against a mock Turnkey API: the request is
  `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2` with `sponsor: true` on
  `eip155:84532`, the USDC calldata has `0xa9059cbb` at `data[0..10]` and the
  treasury at `data[34..74]` (the offsets the policy checks), a repeated event
  id sends nothing, and both denial shapes (HTTP 403, and an activity that
  ends `REJECTED`) record `failed` after one attempt with no retry.
- **Withdraw.** The user's own session calls `ethSendTransaction` (sponsored)
  and `pollTransactionStatus`. _Checked: typecheck only._
- **Validate.** `pnpm validate` checks that the key authenticates and is not
  root, then signs (never broadcasts) five cases: ETH to treasury, ETH
  elsewhere, a raw payload, USDC to treasury, USDC elsewhere. The first three
  are the required allowed, denied, denied. _Checked: the no-address error
  path only._

## Blocked

**The live acceptance run.** It needs things this session does not have:

- an org with Auth Proxy and Gas Sponsorship on, its config ID, and a parent
  API key;
- a browser login as a fresh user (passkey or email OTP);
- a public `https` tunnel (neither `ngrok` nor `cloudflared` is installed);
- 1 USDC on Base Sepolia from the Circle faucet.

Until that run, these assumptions are unverified. Each fails closed if wrong:

1. The policy engine matches lowercase addresses in `eth.tx.to` and
   `eth.tx.data` for sponsored V2 sends (taken from `with-agent-wallet`). If
   wrong, `pnpm validate` shows the treasury send as denied.
2. The webhook payload's `organizationId` is the sub-org that owns the address,
   as the webhooks doc states. If wrong, every sweep logs a sub-org mismatch.
3. Native ETH on Base Sepolia has CAIP-19 `eip155:84532/slip44:60`. If wrong,
   ETH deposits log `not swept` (USDC is matched on its contract address).
4. Turnkey returns a stored policy's `condition` and `consensus` exactly as
   submitted, so the dashboard recognizes it. If not, the dashboard keeps
   showing the Enable button; clicking it is harmless.

## Reproduce

```bash
cd examples/transaction-management/with-deposit-address
cp .env.local.example .env.local   # fill in every value; see README
pnpm dev                           # terminal 1
ngrok http 3000                    # terminal 2; set WEBHOOK_URL from it
pnpm register-webhook              # once
# browser: log in, Enable, send 1 USDC on Base Sepolia to the address
pnpm validate                      # expect allowed, denied, denied (+ USDC pair)
```
