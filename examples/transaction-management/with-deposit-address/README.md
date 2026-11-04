# Example: `with-deposit-address`

A Next.js app that gives each user a deposit address on **Base Sepolia**. ETH or
USDC sent to it is swept to a destination the user chose, by a platform key that
policies the user approved limit to exactly that. The user stays the only root
of their wallet and can withdraw with their own login at any time.

It builds on [`with-delegated/client-side`](../../access-control/with-delegated/client-side)
and uses only existing Turnkey packages.

## What happens

1. **Login.** The user signs in through [Auth Proxy](https://docs.turnkey.com/sdks/react/getting-started)
   with `@turnkey/react-wallet-kit`. This creates their sub-organization and an
   Ethereum wallet. The user is the only root user.
2. **Enable deposit address.** The user enters the address their funds should
   go to and clicks one button. Stamped by the user's session, it:
   - uploads the ERC-20 ABI to the sub-org as a
     [smart contract interface](https://docs.turnkey.com/features/policies/smart-contract-interfaces),
     so the policy can read a transfer's recipient, then calls
   - [`fetchOrCreateP256ApiKeyUser`](https://docs.turnkey.com/generated-docs/formatted/react-wallet-kit/client-context-type-fetch-or-create-p256-api-key-user)
     to add the platform's delegated user (non-root) with the platform's public key, and
   - [`fetchOrCreatePolicies`](https://docs.turnkey.com/generated-docs/formatted/react-wallet-kit/client-context-type-fetch-or-create-policies)
     to add two policies: that user may send ETH, or USDC through `transfer`, to
     that destination and nowhere else.

   The page then shows the address as text and a QR code. The server records
   which sub-org owns it in `data/deposit-addresses.json`, and reads the
   destination from the policies rather than from the browser.

3. **Deposit and sweep.** A `BALANCE_CONFIRMED_UPDATES` webhook on the parent
   org posts to `/api/webhooks/balances`. The route verifies the signature,
   drops repeated event ids, finds the sub-org, and sends the full balance to
   the user's destination with the delegated key and `sponsor: true`, so the address
   needs no gas. The dashboard shows the sweep transaction hash.
4. **Withdraw.** The user enters an address and amount. The send is signed with
   their own session, not the platform key.
5. **Validate.** `pnpm validate` signs with the delegated key and shows what
   the policy allows: send to the destination allowed, send elsewhere denied, raw
   payload signing denied, and USDC `transfer` to the wrong recipient denied.

## Custody model

|               | User                                    | Platform (delegated user)                                                                    |
| ------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Root          | Yes, the only member of the root quorum | No, never. `createUsers` adds users outside the root quorum                                  |
| Credential    | Their login (passkey, email, OAuth)     | A P-256 API key. The private half is `TURNKEY_DA_PRIVATE_KEY`, on the platform's server only |
| Can send to   | Anywhere                                | The user's destination only (ETH sends, and USDC `transfer` with it as recipient)            |
| Cannot        | Nothing is restricted                   | Send anywhere else, sign raw payloads or messages, change users, policies or wallets         |
| Who set it up | The user, by clicking Enable            | Nothing. The platform cannot create its own access                                           |

The policies are the final check. The server code only ever builds sends to the
user's destination, but if it were changed or the key leaked, the policy engine
would still reject any other recipient.

**Why two policies.** The engine evaluates every part of a condition, even when
an earlier part already settles the result
([docs](https://docs.turnkey.com/features/policies/language#evaluation-errors-and-short-circuiting)).
A plain ETH send has no decoded call, so a single condition joining the ETH and
USDC rules with `||` errors on `eth.tx.function_name` and denies the send. Each
rule therefore has its own policy.

The form refuses three destinations: the zero address, the deposit address
itself, and the USDC contract. The ETH policy allows any call to the destination, so
naming the USDC contract would let the key call `approve`, or `transfer` to
anyone.

The server also checks, before it records an address, that the delegated user
is in that sub-org, is not root, and that the address belongs to the sub-org.

**Revoking.** The user can remove the platform's access at any time from their
own session: delete the policies (`deletePolicies`) and the delegated user can
sign nothing, or delete the delegated user (`deleteUsers`) to remove it fully.
This example has no revoke button.

## Adding destinations later

The policies are created with `fetchOrCreatePolicies`, which reuses a policy only
when every field matches. To let the platform sweep somewhere new, such as a
second account or a new payout address, build the new pair at the next login and
pass it to `fetchOrCreatePolicies` from the user's session, then delete the old
pair with `deletePolicies`. A condition can list destinations with `||`
(`eth.tx.to == '<a>' || eth.tx.to == '<b>'`), because both sides can be evaluated
for the same kind of send. Each change needs the user's session, so the platform
cannot widen its own access.

## What the policy can and can't see

The policy engine can enforce a recipient only when the recipient is visible in
the transaction. That means a direct send (`eth.tx.to`), or a parsed contract
call whose ABI has been uploaded (`eth.tx.contract_call_args`). `pnpm validate`
tests this: the delegated key calls the allowed USDC contract with `transfer` to
the wrong recipient and is denied.

For a routing or bridge contract, the policy can limit which contract and
function the key calls, but it can't verify where that contract sends the funds
next.

Sending funds through an intermediate address the platform controls makes the
platform custodial at that hop. This example never does that: each sweep goes
straight from the user's deposit address to the user's destination.

If routes change too often for an allow-list, the next step is a routing app
hosted in an enclave ([Turnkey Verifiable Cloud](https://docs.turnkey.com)). The
delegated key would then accept only routes that the enclave's code has checked,
so the rule lives in verifiable code rather than in a policy condition. This
example does not build it.

## Logging in without a platform login

This example uses Auth Proxy, so the user logs in to the app directly. A platform
embedded in an iframe, with no login of its own, has two non-custodial options:

- **Wallet login.** Reuse the wallet the user already connected in the host app.
- **Bring your own auth over OIDC.** The host issues a token tied to a key
  generated on the user's device. See
  [Bring your own auth](https://docs.turnkey.com/features/authentication/bring-your-own-auth).

An OIDC issuer can impersonate its users, because it can issue a token for a key
it generated itself. If you use this option, policy changes should require a
passkey or MFA, a factor the issuer can't produce. Without that, the issuer could
change where a user's funds go.

## Getting started

### 1. Install

```bash
git clone https://github.com/tkhq/sdk
cd sdk/
corepack enable          # installs pnpm
pnpm install -r
pnpm run build-all
cd examples/transaction-management/with-deposit-address/
```

### 2. Set up Turnkey

In the [Turnkey dashboard](https://app.turnkey.com):

- Note your parent **organization ID**.
- Enable **[Auth Proxy](https://app.turnkey.com/dashboard/walletKit)** and note the **Auth Proxy Config ID**.
- Turn on **Gas Sponsorship** (see [Broadcasting](https://docs.turnkey.com/features/transaction-management/broadcasting)).
- Create a parent-org **API key**. It is used only by `pnpm register-webhook`.

Generate the delegated key pair, which the platform holds:

```bash
node -e 'const k=require("@turnkey/crypto").generateP256KeyPair(); console.log("public: ", k.publicKey); console.log("private:", k.privateKey)'
```

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

| Variable                                  | Where used         | Value                                                                                                |
| ----------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ORGANIZATION_ID`             | browser, server    | Parent organization ID                                                                               |
| `NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID`        | browser            | Auth Proxy Config ID                                                                                 |
| `NEXT_PUBLIC_DEFAULT_DESTINATION_ADDRESS` | browser            | Optional. Pre-fills the destination field to make testing easier. Each user still approves their own |
| `NEXT_PUBLIC_DA_PUBLIC_KEY`               | browser, server    | Delegated public key (66 hex chars, no `0x`). Not secret                                             |
| `TURNKEY_DA_PRIVATE_KEY`                  | server, `validate` | Delegated private key. **Never** prefix it with `NEXT_PUBLIC_` or commit it                          |
| `TURNKEY_API_PUBLIC_KEY`                  | `register-webhook` | Parent-org API public key                                                                            |
| `TURNKEY_API_PRIVATE_KEY`                 | `register-webhook` | Parent-org API private key                                                                           |
| `WEBHOOK_URL`                             | `register-webhook` | Public `https` URL of `/api/webhooks/balances`                                                       |
| `SWEEP_ENABLED`                           | server             | Optional. `false` leaves deposits in place so you can try a withdrawal                               |
| `TURNKEY_API_BASE_URL`                    | server, scripts    | Optional. Defaults to `https://api.turnkey.com`                                                      |

`NEXT_PUBLIC_*` values are built into the browser bundle, so restart `pnpm dev`
after changing them.

### 4. Run

Turnkey only delivers webhooks to a public `https` URL, so expose the app with
a tunnel. [localhost.run](https://localhost.run) needs no account or install, but
its URL can change when it reconnects. [ngrok](https://ngrok.com) also works.

```bash
pnpm dev                     # terminal 1, http://localhost:3000

# terminal 2, then set WEBHOOK_URL to https://<id>.lhr.life/api/webhooks/balances
ssh -o ServerAliveInterval=30 -R 80:localhost:3000 nokey@localhost.run

pnpm register-webhook        # after setting WEBHOOK_URL; reuses a matching subscription
```

Then:

1. Open <http://localhost:3000>, log in, enter a destination, and click **Enable
   deposit address**. **Who controls this wallet** should show four checks: you are
   the only root user, the delegated user is not root, there are exactly two
   policies, and the USDC ABI is uploaded.
2. Send 1 USDC on Base Sepolia (from the [Circle faucet](https://faucet.circle.com))
   or a little Base Sepolia ETH to the address.
3. Within a few seconds of the deposit confirming, **Sweeps to your destination**
   shows the sweep and its transaction hash.
4. Check the policy from the command line:

```bash
pnpm validate                # most recently enabled address
pnpm validate 0xYourAddress  # a specific one
```

```text
✓ Send to destination 0x…: allowed
✓ Send elsewhere 0x…dead: denied
    policy engine: OUTCOME_DENY_IMPLICIT
✓ Sign a raw payload: denied
    policy engine: OUTCOME_ERROR
✓ USDC transfer to wrong recipient 0x…dead: denied
    policy engine: OUTCOME_DENY_IMPLICIT

Control: the same USDC call to the right recipient must pass, or the
denial above says nothing about the recipient check.
✓ USDC transfer to destination 0x…: allowed
```

Nothing is broadcast; the script only asks Turnkey to sign. It first checks
that the key authenticates, is not root, and that the sub-org holds the USDC ABI.
Only the policy engine's own error counts as denied. Any other error, such as an
unknown signing address, fails the check, so a wrong setup cannot pass by accident.
The raw payload shows `OUTCOME_ERROR` because it has no `eth.tx` for the policies to
read, so neither one can allow it.

To try a withdrawal, restart with `SWEEP_ENABLED=false`, deposit again, and use
the **Withdraw** panel.

## Common failures

| Symptom                                                                   | Cause                                                                             | Fix                                                                                                                                                                 |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sweep shows `failed` with a sponsorship or gas error                      | Gas Sponsorship is off for the org, or its spend limit is reached                 | Turn on Gas Sponsorship in the dashboard and check the limits. The sweep is not retried; deposit again after fixing                                                 |
| Deposit never shows up; log says `on eip155:… ignored`, or nothing at all | Sent on the wrong chain (Base mainnet, Ethereum Sepolia)                          | Send on Base Sepolia (`eip155:84532`) only. Funds sent elsewhere stay in the user's wallet under the user's control                                                 |
| `Missing NEXT_PUBLIC_… / TURNKEY_…. Add it to .env.local.`                | Missing env var                                                                   | Fill it in `.env.local`, then restart `pnpm dev`                                                                                                                    |
| Sweep shows `failed … not retrying` with a policy or activity error       | Policy denied the send                                                            | Run `pnpm validate` to see what is allowed. Nothing is retried, and no other address is tried                                                                       |
| ETH sweeps work but USDC sweeps are denied                                | The USDC ABI is missing from the sub-org, so the policy cannot read the recipient | Click **Enable deposit address** again; it uploads the ABI if it is missing                                                                                         |
| Sent back to the login page while using the app                           | The session ended. Console: `Failed to refresh session`                           | Log in again the same way. A different email or a new passkey creates a new sub-org with its own address                                                            |
| "Not watching this address" on the dashboard                              | `TURNKEY_DA_PRIVATE_KEY` does not match `NEXT_PUBLIC_DA_PUBLIC_KEY`               | Use the two halves of the same key pair                                                                                                                             |
| No webhook arrives                                                        | Tunnel URL changed or dropped, or the endpoint was never registered               | Update `WEBHOOK_URL`, rerun `pnpm register-webhook`, and remove the stale endpoint. The next deposit sweeps the full balance, including any deposit that was missed |
| Server log `[webhook] rejected: invalid_signature`                        | A proxy changed the body, or clock skew over 5 minutes                            | Forward the body unchanged and sync the server clock                                                                                                                |

## Limits of this example

- **Demo storage.** The address map is a JSON file, and webhook de-duplication and
  sweep history are in memory, so a restart clears the history. Use a database and
  a durable queue in production. A restart while a sweep is in flight loses that
  sweep's status, not the funds.
- **Sweeps follow webhooks.** Nothing polls for balances, so a deposit made before
  Enable, or whose webhook was missed, stays put until the next deposit sweeps the
  whole balance. The user can withdraw it at any time.
- **One chain, two assets, one destination per user.** No other chains, tokens,
  swaps or bridges. This example has no form for changing a destination later.
- **One ABI upload per sub-org.** Turnkey reads smart contract interfaces only
  from the sub-org sending the transaction, so each user's Enable uploads its own
  copy.
- **Chain not pinned in the policy.** The delegated key can pay only the user's
  destination, but on any chain.
