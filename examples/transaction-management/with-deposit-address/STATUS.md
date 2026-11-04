# Status

## Decisions from section 4 of the scope

**1. Where does the delegated key live?** In a server-side env var,
`TURNKEY_DA_PRIVATE_KEY`, as in `with-delegated/client-side`. Only API routes
and the scripts read it. The public half is `NEXT_PUBLIC_DA_PUBLIC_KEY`,
because the browser needs it to create the delegated user from the user's
session. The base example kept the public key in two variables; this one uses
one, since a public key is not secret.

**2. ERC-20 policy condition.** Changed by the scope update below. The policy
now reads the decoded recipient, using the ERC-20 ABI uploaded as a smart contract
interface (`/features/policies/smart-contract-interfaces`,
`/features/policies/language`):

```
eth.tx.to == '<destination>' ||
(eth.tx.to == '<usdc>' && eth.tx.function_name == 'transfer' &&
 (eth.tx.contract_call_args['recipient'] == '<destination, lowercase>' ||
  eth.tx.contract_call_args['recipient'] == '<destination, checksummed>'))
```

`recipient` is the argument name in viem's `erc20Abi`, which is the ABI uploaded.
A parent-org upload does not count, as `with-scoped-deposit-session` records, so
Enable uploads it into each sub-org, stamped by the user's session.

The docs do not say how a decoded address is cased, and their one literal example
is mixed-case, so the clause accepts both spellings of the same address. Both name
one address, so this widens nothing. The live run should show which is needed;
the other can then be removed.

**Fallback, not used so far:** the raw calldata check
(`eth.tx.data[0..10] == '0xa9059cbb' && eth.tx.data[34..74] == '<destination
without 0x>'`). It replaces the ABI clause if the live run shows the ABI path does
not work, and that switch will be recorded here.

Addresses in `eth.tx.to` are lowercase, following `with-agent-wallet`. The
policy does not pin the chain (`eth.tx.chain_id`), because the docs do not say
it is populated for sponsored `ETH_SEND_TRANSACTION_V2` activities. The key can
only ever pay the user's destination, on any chain.

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

## Scope update: what changed after Mesh's questions

| #   | Change                                                                                                | Code | Checked live |
| --- | ----------------------------------------------------------------------------------------------------- | ---- | ------------ |
| 1   | Per-user destination, entered at Enable, approved in the user's session, with an optional env default | Done | No           |
| 2   | ERC-20 ABI uploaded at Enable; the USDC clause checks the decoded recipient                           | Done | No           |
| 3   | Fourth `pnpm validate` check: USDC `transfer` to the wrong recipient is denied                        | Done | No           |
| 4   | README section, "What the policy can and can't see"                                                   | Done | n/a          |
| 5   | README note on login for a platform with no login of its own                                          | Done | n/a          |

Three additions the update did not ask for:

- **Refused destinations.** The zero address, the deposit address and the USDC
  contract are rejected. A destination is now user input, and the policy allows
  any call to it, so naming the USDC contract would give the key `approve`, and
  `transfer` to anyone. Naming the deposit address would sweep deposits into a
  loop that spends gas sponsorship. The server repeats this check on the policy.
- **A control beside the four checks.** `pnpm validate` also expects USDC to the
  right recipient to be allowed. Without it, a missing ABI would deny every USDC
  call and check 4 would pass for the wrong reason.
- **Light theme only.** The dark-mode color rule is removed. Every panel is a
  white card, so inherited light text, including the deposit address and typed
  input, could not be read. It also made the login text unreadable.

The server reads each destination from the user's policy, not from the browser,
so a forged request cannot point a registration at another address.

## Progress

| Day | Slice                                        | Code | Checked live |
| --- | -------------------------------------------- | ---- | ------------ |
| 1   | Copy base, enable button, policy, QR code    | Done | No           |
| 2   | Webhook registration, verified webhook route | Done | No           |
| 3   | Sponsored sweep, de-duplication              | Done | No           |
| 4   | User-signed withdraw, `pnpm validate`        | Done | No           |
| 5   | README, PR                                   | Done | n/a          |

`pnpm typecheck`, prettier and `next build` are clean. Nothing has been run
against live Turnkey or Base Sepolia yet; see Blocked. The "Checked offline" notes
below are mock runs: they test this code, not the real policy engine.

## What is built, and how it was checked

- **Enable.** "Enable deposit address" takes the user's destination, uploads the
  USDC ABI, and creates the delegated user (`fetchOrCreateP256ApiKeyUser`) and its
  one policy (`fetchOrCreatePolicies`), all stamped by the user's session. `createUsers` never touches the root
  quorum (read in `packages/core/src/__clients__/core.ts`). The dashboard
  shows the address and a QR code and checks live that the user is the sole
  root, the delegated user is not root, there is exactly one policy, and the ABI
  is uploaded. _Checked: typecheck and build only._ Destination rules and policy
  recognition _checked offline_.
- **Registration.** Before recording an address, the server confirms with the
  delegated key that the key's user is in the sub-org, is not root, and owns
  the address, then reads the destination from the one sweep policy. _Checked
  offline_ against a mock API: no policy, two policies, and a policy naming USDC
  are all refused.
- **Webhook.** `pnpm register-webhook` subscribes the parent org's
  `BALANCE_CONFIRMED_UPDATES`, reusing an existing subscription. The route
  verifies the signature against the JWKS, drops repeated event ids, and maps
  the address to its sub-org. _Checked offline_ with a local JWKS and
  Ed25519-signed deliveries: valid (200, logged with sub-org), repeated event
  id (ignored), tampered body (401), stale timestamp (401), unsigned (401),
  unknown address (ignored), sub-org mismatch (ignored, not swept).
- **Sweep.** Reads the balance, then sends all of it to the user's destination from the
  deposit address with `sponsor: true`, signed by the delegated key. Sweeps
  per address run in order; failures are logged and never retried. _Checked
  offline_ against a mock Turnkey API: the request is
  `ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2` with `sponsor: true` on
  `eip155:84532`, the USDC call decodes to `transfer` with the user's destination
  as recipient (rerun after the scope update), a repeated event id sends nothing, and both denial shapes (HTTP 403, and an activity that
  ends `REJECTED`) record `failed` after one attempt with no retry.
- **Withdraw.** The user's own session calls `ethSendTransaction` (sponsored)
  and `pollTransactionStatus`. _Checked: typecheck only._
- **Validate.** `pnpm validate` checks that the key authenticates and is not
  root, and the sub-org holds the USDC ABI, then signs (never broadcasts): ETH to the
  destination, ETH elsewhere, a raw payload, USDC to the wrong recipient, and USDC
  to the destination as a control. The first four are the required allowed,
  denied, denied, denied. _Checked offline_ against a mock that decodes each
  transaction the way the policy should. This tests the script, not the engine.

## Blocked

**The live acceptance run.** It needs things this session does not have:

- an org with Auth Proxy and Gas Sponsorship on, its config ID, and a parent
  API key;
- a browser login as a fresh user (passkey or email OTP);
- a public `https` tunnel (neither `ngrok` nor `cloudflared` is installed);
- 1 USDC on Base Sepolia from the Circle faucet.

Until that run, these assumptions are unverified. Each fails closed if wrong:

1. The policy engine matches lowercase addresses in `eth.tx.to` for sponsored V2
   sends (taken from `with-agent-wallet`). If wrong, `pnpm validate` shows the
   send to the destination as denied.
2. The webhook payload's `organizationId` is the sub-org that owns the address,
   as the webhooks doc states. If wrong, every sweep logs a sub-org mismatch.
3. Native ETH on Base Sepolia has CAIP-19 `eip155:84532/slip44:60`. If wrong,
   ETH deposits log `not swept` (USDC is matched on its contract address).
4. Turnkey returns a stored policy's `condition` and `consensus` exactly as
   submitted, so the dashboard recognizes it. If not, the dashboard keeps
   showing the Enable button; clicking it is harmless.

5. `eth.tx.contract_call_args['recipient']` equals one of the two spellings in
   the policy, for both signing and sponsored V2 sends. `function_name` on V2
   sends was checked live in `atomic-batch-with-aave`; decoded address arguments
   were not. If wrong, the USDC control shows as denied and USDC sweeps fail; the
   raw calldata fallback applies.
6. A user's session can upload an interface into their own sub-org. If not,
   Enable shows the error and creates nothing further.
7. The delegated key can read policies and interfaces in the sub-org. If not,
   registration and `pnpm validate` fail with that error, and nothing is swept.

## Reproduce

```bash
cd examples/transaction-management/with-deposit-address
cp .env.local.example .env.local   # fill in every value; see README
pnpm dev                           # terminal 1
ngrok http 3000                    # terminal 2; set WEBHOOK_URL from it
pnpm register-webhook              # once
# browser: log in, enter a destination, Enable, send 1 USDC on Base Sepolia to the address
pnpm validate                      # expect allowed, denied, denied, denied (+ control)
```
