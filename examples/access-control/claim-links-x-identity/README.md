# Example: `claim-links-x-identity`

**This is a proof of concept / demo, not production code.**

This Next.js 15 example pre-creates a Turnkey sub-organization and Solana wallet for an immutable numeric X user ID. The assigned X account can claim it through X OAuth 2.0 + PKCE, Turnkey `OAuth2Authenticate`, provider attachment, root-quorum handoff, and `oauth_login`.

## Security model and an important boundary

Turnkey root-quorum users bypass the policy engine. The API-key backend must temporarily be the sole root to create the claimant, attach OAuth, install the claimant policy, and hand over root. Consequently, **no policy can deny that key from signing before handoff**. This demo creates an explicit backend signing-deny policy during pre-association, but it becomes enforceable only after the claimant replaces the backend in root quorum. Do not fund a pre-associated address. Transfer or deposit value only after `pnpm demo:verify` and `pnpm attack` both pass.

The sibling [`claim-links-delegated-reclaim`](../claim-links-delegated-reclaim/) example can demote a bootstrap key before use because it starts with two roots. Its order is: create the claim and sweep users as roots, let the sweep root install its policy, then remove only the sweep user from root quorum. This example starts with one backend root because the future claimant does not exist before X authentication. Turnkey does not permit an empty root quorum, so the backend cannot self-demote before the verified claimant is ready to replace it. That difference forces the latent-deny and fund-only-after-claim sequence.

The policy language does not expose a dependable “has an X provider” approver predicate. The claim route therefore installs a signing allow bound to the exact claimant user ID after verifying the Turnkey-issued `sub`. Recovery that replaces the user must deliberately replace this policy.

## Relationship to claim-links-delegated-reclaim

Both examples build claim links with per-allocation Turnkey sub-organizations, but they grant the right to claim differently.

| | [Bearer-link model](../claim-links-delegated-reclaim/) | Identity-bound model (this example) |
| --- | --- | --- |
| Right to claim | Possession of a claim key in the URL fragment | Control of the allocated numeric X account |
| Gate | The fragment secret is the credential; possession grants the claim | Turnkey verifies the numeric X ID in its enclave during OAuth |
| Forwarding risk | A recipient can leak or forward the bearer secret | There is no bearer claim secret to leak or forward |
| Expiry and reclaim | Claim-key TTL plus a sweep key for automatic return to the sender | Not implemented; value must arrive only after claim gates pass |
| Policy bootstrap | Delegated Access with two roots; the sweep key installs its policy and demotes itself | One temporary backend root; its signing deny is latent until claimant root rotation |

## Setup

From the repository root, install and build workspace dependencies:

```bash
corepack enable
pnpm install -r
pnpm run build-all
cd examples/access-control/claim-links-x-identity
cp .env.local.example .env.local
```

Create a Turnkey organization and a P-256 API keypair. Put its organization ID and API key values in `.env.local`; this key becomes each allocation's temporary backend root.

In the X developer portal, create an OAuth 2.0 **Web App** with Read permission. Set the callback to exactly `http://127.0.0.1:3456/auth/x/redirect`. Use `127.0.0.1`, **not `localhost`**: X, the environment value, and the browser origin must match exactly. Add the X client ID to `.env.local`, then upload the X client secret to Turnkey:

```bash
pnpm credential-upload -- '<X client secret>'
```

Copy the returned credential ID into `OAUTH2_CREDENTIAL_ID`. The copied `credential-upload.tsx` is unchanged from `with-x`.

## Resolve X IDs

Allocations bind to stable numeric IDs, never handles. Manual mode accepts `handle:numeric_id` values (see `handles.example.txt`):

```bash
X_LOOKUP_MODE=manual pnpm preassociate -- turnkey:2244994945
```

Live mode resolves handles through `GET https://api.x.com/2/users/by?usernames=...` and requires `X_BEARER_TOKEN`:

```bash
X_LOOKUP_MODE=live X_BEARER_TOKEN=... pnpm preassociate -- turnkey
```

Re-running pre-association skips a matching `claim:x:<numeric_id>` allocation.

## Run the demo

```bash
pnpm demo -- turnkey:2244994945
pnpm dev
```

Open the printed `http://127.0.0.1:3456/claim/<subOrgId>` URL and log in with the assigned X account. A different numeric X subject receives HTTP 403 with `this allocation belongs to a different X account`. After the dashboard opens, verify the provider and exclusive claimant root, then prove the old backend cannot sign:

```bash
pnpm demo:verify -- <subOrgId>
pnpm attack -- <subOrgId>
```

The attack gate passes only when it prints `DENIED AS EXPECTED: <reason>` and exits 0. A successful signature is a security failure and exits 1. `pnpm demo -- --dry-run` prints the lifecycle without credentials; `pnpm test:claim-gate` checks a forged-sub mismatch locally.

## Why funds move only at claim

Pre-association creates an address for a numeric X ID, but the operator must not fund it while the backend remains temporary root. The claim gate compares the Turnkey-issued `x:<numeric_id>` subject with the ID embedded in the allocation name, so handle changes and handle squatting do not redirect an allocation. A successful match creates the claimant, attaches that X identity, installs a claimant-specific signing allow, and rotates root quorum exclusively to that claimant. The previously installed deny then policy-blocks the demoted backend key from raw signing. Funds move to the verified address only after the post-claim verification and adversarial signing gate pass.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| X reports a callback error | Callback uses `localhost`, a different port, or a different path | Use exactly `http://127.0.0.1:3456/auth/x/redirect` everywhere |
| `Missing OAUTH2_CREDENTIAL_ID` or authentication fails | X client secret was not uploaded | Run `pnpm credential-upload -- '<secret>'` and copy its output to `.env.local` |
| HTTP 403 with the allocation message | Authenticated numeric X ID differs from the allocation ID | Sign out of X and authenticate as the assigned account; never edit IDs to match a handle |
| `DENIED AS EXPECTED` | Expected post-claim backend policy denial | Treat it as a passing attack gate; investigate if signing succeeds instead |
| X authorization is unavailable or limited | X app approval is pending or permissions are wrong | Complete X approval and enable OAuth 2.0 Web App + Read permission |

## What production adds

- TTL reclaim based on the production reference pattern in [`claim-links-delegated-reclaim`](../claim-links-delegated-reclaim/)
- Durable allocation state, batch jobs, retries, idempotency locks, and X API rate-limit handling
- Post-claim passkey enrollment and recovery policies
- A target-chain transfer/deposit step gated on verification and backend attack denial
- Monitoring and alerts for claim failures, root changes, policy changes, and signing attempts
- An Option A upgrade using cold `oidcClaims` pre-registration if Turnkey confirms that lifecycle for X

## Policy expressions

See the heavily commented reusable documents in `src/lib/policies.ts`. Their conditions are `activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'`; consensus is bound respectively to the concrete backend user ID (deny) and concrete claimant user ID (allow). With no other allow policy, non-root activity is default-denied.
