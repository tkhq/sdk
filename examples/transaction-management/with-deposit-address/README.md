# Example: `with-deposit-address`

A Next.js app that gives each user a deposit address on **Base Sepolia**. ETH or
USDC sent to it is swept to a fixed treasury address by a platform key that a
policy limits to exactly that. The user stays the only root of their wallet and
can withdraw with their own login at any time.

It builds on [`with-delegated/client-side`](../../access-control/with-delegated/client-side)
and uses only existing Turnkey packages.

## What happens

1. **Login.** The user signs in through [Auth Proxy](https://docs.turnkey.com/sdks/react/getting-started)
   with `@turnkey/react-wallet-kit`. This creates their sub-organization and an
   Ethereum wallet. The user is the only root user.
2. **Enable deposit address.** One button. Stamped by the user's session, it
   calls:
   - [`fetchOrCreateP256ApiKeyUser`](https://docs.turnkey.com/generated-docs/formatted/react-wallet-kit/client-context-type-fetch-or-create-p256-api-key-user)
     to add the platform's delegated user (non-root) with the platform's public key, and
   - [`fetchOrCreatePolicies`](https://docs.turnkey.com/generated-docs/formatted/react-wallet-kit/client-context-type-fetch-or-create-policies)
     to add one policy: that user may send ETH, or USDC through `transfer`, to the
     treasury and nowhere else.

   The page then shows the address as text and a QR code, and the server records
   which sub-org owns it in `data/deposit-addresses.json`.

3. **Deposit and sweep.** A `BALANCE_CONFIRMED_UPDATES` webhook on the parent
   org posts to `/api/webhooks/balances`. The route verifies the signature,
   drops repeated event ids, finds the sub-org, and sends the full balance to
   the treasury with the delegated key and `sponsor: true`, so the address
   needs no gas. The dashboard shows the sweep transaction hash.
4. **Withdraw.** The user enters an address and amount. The send is signed with
   their own session, not the platform key.
5. **Validate.** `pnpm validate` signs with the delegated key and shows what
   the policy allows: send to treasury allowed, send elsewhere denied, raw
   payload signing denied.

## Custody model

|               | User                                    | Platform (delegated user)                                                                    |
| ------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Root          | Yes, the only member of the root quorum | No, never. `createUsers` adds users outside the root quorum                                  |
| Credential    | Their login (passkey, email, OAuth)     | A P-256 API key. The private half is `TURNKEY_DA_PRIVATE_KEY`, on the platform's server only |
| Can send to   | Anywhere                                | The treasury only (ETH sends, and USDC `transfer` with the treasury as recipient)            |
| Cannot        | Nothing is restricted                   | Send anywhere else, sign raw payloads or messages, change users, policies or wallets         |
| Who set it up | The user, by clicking Enable            | Nothing. The platform cannot create its own access                                           |

The policy is the final check. The server code only ever builds sends to the
treasury, but if it were changed or the key leaked, the policy engine would
still reject any other destination.

The server also checks, before it records an address, that the delegated user
is in that sub-org, is not root, and that the address belongs to the sub-org.

**Revoking.** The user can remove the platform's access at any time from their
own session: delete the policy (`deletePolicies`) and the delegated user can
sign nothing, or delete the delegated user (`deleteUsers`) to remove it fully.
This example has no revoke button.

## Adding destinations later

The policy is created with `fetchOrCreatePolicies`, which reuses a policy only
when every field matches. To let the platform sweep somewhere new, such as a
second treasury or a payout address, build the new policy at the next login and
pass it to `fetchOrCreatePolicies` from the user's session, then delete the old
policy with `deletePolicies` so there is still one. The condition can list
destinations with `||` (`eth.tx.to == '<a>' || eth.tx.to == '<b>'`). Each change
needs the user's session, so the platform cannot widen its own access.

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

| Variable                           | Where used         | Value                                                                       |
| ---------------------------------- | ------------------ | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_ORGANIZATION_ID`      | browser, server    | Parent organization ID                                                      |
| `NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID` | browser            | Auth Proxy Config ID                                                        |
| `NEXT_PUBLIC_TREASURY_ADDRESS`     | browser, server    | The one address sweeps go to                                                |
| `NEXT_PUBLIC_DA_PUBLIC_KEY`        | browser, server    | Delegated public key (66 hex chars, no `0x`). Not secret                    |
| `TURNKEY_DA_PRIVATE_KEY`           | server, `validate` | Delegated private key. **Never** prefix it with `NEXT_PUBLIC_` or commit it |
| `TURNKEY_API_PUBLIC_KEY`           | `register-webhook` | Parent-org API public key                                                   |
| `TURNKEY_API_PRIVATE_KEY`          | `register-webhook` | Parent-org API private key                                                  |
| `WEBHOOK_URL`                      | `register-webhook` | Public `https` URL of `/api/webhooks/balances`                              |
| `SWEEP_ENABLED`                    | server             | Optional. `false` leaves deposits in place so you can try a withdrawal      |
| `TURNKEY_API_BASE_URL`             | server, scripts    | Optional. Defaults to `https://api.turnkey.com`                             |

`NEXT_PUBLIC_*` values are built into the browser bundle, so restart `pnpm dev`
after changing them.

### 4. Run

Turnkey only delivers webhooks to a public `https` URL, so expose the app with
a tunnel such as [ngrok](https://ngrok.com):

```bash
pnpm dev                     # terminal 1, http://localhost:3000
ngrok http 3000              # terminal 2, then set WEBHOOK_URL to
                             # https://<id>.ngrok-free.app/api/webhooks/balances
pnpm register-webhook        # once; reuses the subscription if it exists
```

Then:

1. Open <http://localhost:3000>, log in, and click **Enable deposit address**.
   The right panel should show three checks: you are the sole root, the
   delegated user is not root, and there is exactly one policy.
2. Send 1 USDC on Base Sepolia (from the [Circle faucet](https://faucet.circle.com))
   or a little Base Sepolia ETH to the address.
3. Within a few seconds of the deposit confirming, **Sweeps to treasury**
   shows the sweep and its transaction hash.
4. Check the policy from the command line:

```bash
pnpm validate                # most recently enabled address
pnpm validate 0xYourAddress  # a specific one
```

```text
✓ Send to treasury 0x…: allowed
✓ Send elsewhere 0x…dead: denied
✓ Sign a raw payload: denied

USDC branch of the same policy:
✓ USDC transfer to treasury: allowed
✓ USDC transfer elsewhere: denied
```

Nothing is broadcast; the script only asks Turnkey to sign. It first checks
that the key authenticates and is not root, so a wrong key fails loudly
instead of showing up as "denied".

To try a withdrawal, restart with `SWEEP_ENABLED=false`, deposit again, and use
the **Withdraw** panel.

## Common failures

| Symptom                                                                   | Cause                                                               | Fix                                                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sweep shows `failed` with a sponsorship or gas error                      | Gas Sponsorship is off for the org, or its spend limit is reached   | Turn on Gas Sponsorship in the dashboard and check the limits. The sweep is not retried; deposit again after fixing                                     |
| Deposit never shows up; log says `on eip155:… ignored`, or nothing at all | Sent on the wrong chain (Base mainnet, Ethereum Sepolia)            | Send on Base Sepolia (`eip155:84532`) only. Funds sent elsewhere stay in the user's wallet under the user's control                                     |
| `Missing NEXT_PUBLIC_… / TURNKEY_…. Add it to .env.local.`                | Missing env var                                                     | Fill it in `.env.local`, then restart `pnpm dev`                                                                                                        |
| Sweep shows `failed … not retrying` with a policy or activity error       | Policy denied the send                                              | Usually `NEXT_PUBLIC_TREASURY_ADDRESS` changed after the user enabled, so the policy names the old treasury. Run `pnpm validate` to see what is allowed |
| "Not watching this address" on the dashboard                              | `TURNKEY_DA_PRIVATE_KEY` does not match `NEXT_PUBLIC_DA_PUBLIC_KEY` | Use the two halves of the same key pair                                                                                                                 |
| No webhook arrives                                                        | Tunnel URL changed, or the endpoint was never registered            | Update `WEBHOOK_URL`, rerun `pnpm register-webhook`, and remove the stale endpoint in the dashboard                                                     |
| Server log `[webhook] rejected: invalid_signature`                        | A proxy changed the body, or clock skew over 5 minutes              | Forward the body unchanged and sync the server clock                                                                                                    |

## Limits of this example

- **Demo storage.** The address map is a JSON file and webhook de-duplication is
  in memory. Use a database and a durable queue in production. A restart while a
  sweep is in flight loses that sweep's status, not the funds.
- **One chain, two assets, one treasury.** No other chains, tokens, swaps or
  bridges.
- **Raw calldata check for USDC.** The policy checks the `transfer` selector and
  recipient bytes, because named arguments (`eth.tx.contract_call_args`) need
  the USDC ABI uploaded as a [smart contract interface](https://docs.turnkey.com/features/policies/smart-contract-interfaces)
  in every sub-org.
- **Chain not pinned in the policy.** The delegated key can pay only the
  treasury, but on any chain.
