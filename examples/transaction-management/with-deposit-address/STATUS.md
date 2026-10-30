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

| Day | Slice                                        | State |
| --- | -------------------------------------------- | ----- |
| 1   | Copy base, enable button, policy, QR code    | Done  |
| 2   | Webhook registration, verified webhook route | Done  |
| 3   | Sponsored sweep, de-duplication              | -     |
| 4   | User-signed withdraw, `pnpm validate`        | -     |
| 5   | README, PR                                   | -     |

## What works

- Login through Auth Proxy, then "Enable deposit address" creates the delegated
  user (`fetchOrCreateP256ApiKeyUser`) and its one policy
  (`fetchOrCreatePolicies`), both stamped by the user's session.
- The dashboard shows the address and a QR code, and checks the sub-org live:
  root quorum is the user alone, the delegated user is not root, and there is
  exactly one policy.
- `pnpm register-webhook` subscribes the parent org's
  `BALANCE_CONFIRMED_UPDATES` to `/api/webhooks/balances`; running it twice
  reuses the existing subscription.
- The webhook route verifies the signature against the JWKS, drops repeated
  event ids, and maps the address to its sub-org through
  `data/deposit-addresses.json`. Checked offline against a local JWKS with
  signed deliveries: valid (200, logged with sub-org), repeated event id
  (ignored), tampered body (401), stale timestamp (401), unsigned (401),
  unknown address (ignored), sub-org mismatch (ignored, not swept).

## Blocked

Nothing yet.

## Reproduce

```bash
cd examples/transaction-management/with-deposit-address
cp .env.local.example .env.local   # fill in the values
pnpm dev
```
