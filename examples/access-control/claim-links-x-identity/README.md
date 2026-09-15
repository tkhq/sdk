# Example: `claim-links-x-identity`

**This is a proof of concept / demo, not production code.**

This Next.js 15 example pre-creates a Turnkey sub-organization and Solana wallet for an immutable numeric X user ID. The assigned X account can claim it through X OAuth 2.0 + PKCE, Turnkey `OAuth2Authenticate`, provider attachment, root-quorum handoff, and `oauth_login`.

The claim is bound to the account's **numeric X ID**, never its handle. Handles can be changed and re-registered; numeric IDs cannot. An allocation therefore cannot be redirected by a handle change or by handle squatting.

## Try it in 30 seconds

These need no Turnkey organization, no X application, and no credentials. From this directory, after `pnpm install -r` and `pnpm run build-all` at the repository root:

```bash
pnpm demo -- --dry-run    # prints the five-step lifecycle
pnpm test:claim-gate      # proves a forged OIDC subject cannot cross the gate
```

Expected:

```text
PASS: forged OIDC sub cannot cross the numeric-X-ID claim gate
```

Everything below sets up the full flow against live Turnkey and X.

## Prerequisites

Budget roughly 30 minutes, plus however long X takes to approve your developer application.

| | Why |
| --- | --- |
| A Turnkey organization and a P-256 API keypair | Becomes each allocation's temporary backend root |
| **Two** X accounts | One is the assigned claimant; the second proves the 403 rejection |
| An X developer app (OAuth 2.0, confidential client) | Turnkey exchanges the authorization code with it |
| `pnpm` 10.16.0 | Pinned by this repo; see the note in Setup |

The X Developer Program application asks for a use-case description of at least 100 characters and **may sit pending approval**. Start it first if you are on a schedule. Your app must be created as a **Web App, Automated App or Bot** — only that type is a confidential client and is issued the client secret this example uploads to Turnkey. A Native App or Single Page App yields no secret and cannot work.

## Setup

From the repository root, install and build workspace dependencies. `pnpm run build-all` is required, not optional: the example imports workspace packages, and `pnpm typecheck` fails against stale `dist` output without it.

This repo pins `pnpm@10.16.0`. An older pnpm on your `PATH` (a Homebrew install often shadows corepack's) cannot bootstrap that version and fails with `Unknown options: 'allow-build'`. Check `pnpm --version` first.

```bash
corepack enable
pnpm install -r
pnpm run build-all
cd examples/access-control/claim-links-x-identity
cp .env.local.example .env.local
```

Create a Turnkey organization and a P-256 API keypair. Put its organization ID and API key values in `.env.local`; this key becomes each allocation's temporary backend root.

In the X developer portal, open your app's **User authentication settings** and set it up with **Read** permission. Set the callback to exactly `http://127.0.0.1:3456/auth/x/redirect`. Use `127.0.0.1`, **not `localhost`**: X, the environment value, and the browser origin must match exactly.

Saving that form is when X reveals the **OAuth 2.0 Client ID and Client Secret**, under that heading — not the "API Key and Secret" or "Bearer Token" shown higher on the Keys and tokens page, which belong to older credential families this example does not use. The secret is shown once.

Add the client ID to `.env.local` as `X_CLIENT_ID`, then upload the client secret to Turnkey:

```bash
pnpm credential-upload -- '<X client secret>'
```

The secret is encrypted to Turnkey and never stored in `.env.local`. Copy the returned credential ID into `OAUTH2_CREDENTIAL_ID`. `credential-upload.tsx` is copied from `with-x`, with one change: it strips the `--` separator that pnpm forwards to the script, which otherwise makes it reject its own documented invocation.

## Finding a numeric X ID

Allocations bind to `handle:numeric_id` pairs, and **the numeric half is authoritative**. Look the ID up rather than guessing it; a mismatched pair produces an allocation nobody can claim.

With a Bearer Token from your app's Keys and tokens page:

```bash
curl -H "Authorization: Bearer $X_BEARER_TOKEN" \
  "https://api.x.com/2/users/by/username/<handle>"
```

Or let the example resolve handles for you in live mode:

```bash
X_LOOKUP_MODE=live X_BEARER_TOKEN=... pnpm preassociate -- turnkey
```

Manual mode takes the pair directly and needs no X API access (see `handles.example.txt`):

```bash
X_LOOKUP_MODE=manual pnpm preassociate -- turnkey:16088008
```

`X_LOOKUP_MODE` defaults to `manual`. Re-running pre-association skips a matching `claim:x:<numeric_id>` allocation, so it is safe to run twice.

## Run the demo

`pnpm demo` resolves the targets and delegates to `pnpm preassociate`; use `demo` unless you want pre-association alone.

**1. Allocate.** Substitute your own claimant's handle and numeric ID:

```bash
pnpm demo -- turnkey:16088008
```

```text
CREATED @turnkey 16088008: http://127.0.0.1:3456/claim/08ecd397-...
SOLANA ADDRESS (DO NOT FUND BEFORE CLAIM GATES PASS): 2C6fhniK6Ft...
```

Re-running prints `SKIP @turnkey 16088008: <subOrgId>` instead of allocating again.

**2. Start the app.**

```bash
pnpm dev
```

**3. Prove the gate rejects the wrong account.** Open the printed `/claim/<subOrgId>` URL while signed in to your *second* X account. Expect HTTP 403 and `this allocation belongs to a different X account`. Do this before the successful claim — it is the check the whole design rests on, and it is far more convincing before you know the happy path works.

**4. Claim.** Sign out of X, sign in as the assigned account, and open the claim URL again. The dashboard opens once handoff completes.

**5. Verify the handoff.**

```bash
pnpm demo:verify -- <subOrgId>
```

```text
VERIFIED CLAIM: 08ecd397-... -> X 16088008 -> ce551a22-...
```

Before a claim this correctly fails with `verified X claimant is not attached`.

**6. Run the adversarial gate.**

```bash
pnpm attack -- <subOrgId>
```

```text
DENIED AS EXPECTED: Turnkey error 7: policy engine denied request...
```

The gate passes only when it prints `DENIED AS EXPECTED` and exits 0. A successful signature is a security failure and exits 1.

**Before claim, this command prints `SECURITY FAILURE` and that is the expected result.** The backend is still sole root, and root quorum bypasses the policy engine, so the latent deny cannot yet be enforced. A pre-claim run tells you nothing except that the boundary described below is real — which is precisely why funds must wait.

**7. Only now move value**, if you are going that far.

Each allocation creates a Turnkey sub-organization that cannot be deleted, so repeated runs accumulate them in your organization. Vary the numeric ID to allocate again, or reuse the same one and let idempotency skip it.

## Security model and an important boundary

Turnkey root-quorum users bypass the policy engine. The API-key backend must temporarily be the sole root to create the claimant, attach OAuth, install the claimant policy, and hand over root. Consequently, **no policy can deny that key from signing before handoff**. This demo creates an explicit backend signing-deny policy during pre-association, but it becomes enforceable only after the claimant replaces the backend in root quorum. Do not fund a pre-associated address. Transfer or deposit value only after `pnpm demo:verify` and `pnpm attack` both pass.

The sibling [`claim-links-delegated-reclaim`](../claim-links-delegated-reclaim/) example can demote a bootstrap key before use because it starts with two roots. Its order is: create the claim and sweep users as roots, let the sweep root install its policy, then remove only the sweep user from root quorum. This example starts with one backend root because the future claimant does not exist before X authentication. Turnkey does not permit an empty root quorum, so the backend cannot self-demote before the verified claimant is ready to replace it. That difference forces the latent-deny and fund-only-after-claim sequence.

The policy language does not expose a dependable “has an X provider” approver predicate. The claim route therefore installs a signing allow bound to the exact claimant user ID after verifying the Turnkey-issued `sub`. Recovery that replaces the user must deliberately replace this policy.

## Why funds move only at claim

Pre-association creates an address for a numeric X ID, but the operator must not fund it while the backend remains temporary root. The claim gate compares the Turnkey-issued `x:<numeric_id>` subject with the ID embedded in the allocation name, so handle changes and handle squatting do not redirect an allocation. A successful match creates the claimant, attaches that X identity, installs a claimant-specific signing allow, and rotates root quorum exclusively to that claimant. The previously installed deny then policy-blocks the demoted backend key from raw signing. Funds move to the verified address only after the post-claim verification and adversarial signing gate pass.

## Relationship to claim-links-delegated-reclaim

Both examples build claim links with per-allocation Turnkey sub-organizations, but they grant the right to claim differently.

| | [Bearer-link model](../claim-links-delegated-reclaim/) | Identity-bound model (this example) |
| --- | --- | --- |
| Right to claim | Possession of a claim key in the URL fragment | Control of the allocated numeric X account |
| Gate | The fragment secret is the credential; possession grants the claim | Turnkey verifies the numeric X ID in its enclave during OAuth |
| Forwarding risk | A recipient can leak or forward the bearer secret | There is no bearer claim secret to leak or forward |
| Expiry and reclaim | Claim-key TTL plus a sweep key for automatic return to the sender | Not implemented; value must arrive only after claim gates pass |
| Policy bootstrap | Delegated Access with two roots; the sweep key installs its policy and demotes itself | One temporary backend root; its signing deny is latent until claimant root rotation |

## Policy expressions

See the heavily commented reusable documents in `src/lib/policies.ts`. Their conditions are `activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'`; consensus is bound respectively to the concrete backend user ID (deny) and concrete claimant user ID (allow). With no other allow policy, non-root activity is default-denied.

### Why the gate signs a raw payload

The allocation wallet is Solana, so its accounts are ed25519 and `TRANSACTION_TYPE_ETHEREUM` does not apply. Beyond that, `SIGN_RAW_PAYLOAD_V2` is the right primitive for an adversarial gate: it asks the narrowest possible question — can this credential produce a signature at all — without needing a well-formed unsigned transaction, whose own construction errors (a stale blockhash, say) would be indistinguishable from a policy denial.

Note that ed25519 requires `HASH_FUNCTION_NOT_APPLICABLE`. Ed25519 hashes during signature computation rather than before it, so passing a hash function returns a validation error that fires *before* policy evaluation — which would make the gate fail identically whether or not the policy works. See the [Turnkey FAQ](https://docs.turnkey.com/reference/faq#what-is-hash_function_not_applicable-and-how-does-it-differ-from-hash_function_no_op).

**Coverage limit.** Both policies, and the attack gate, name only `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2`. A demoted backend could instead attempt `ACTIVITY_TYPE_SIGN_TRANSACTION_V2` or the batch `ACTIVITY_TYPE_SIGN_RAW_PAYLOADS`. Those are implicitly denied — the demoted backend is a non-root user with no allow policy — so this is not an exploitable hole. But the explicit deny exists precisely to survive a future accidental broad allow, and it would not cover those two activity types. Production should enumerate every signing activity type it means to deny, and the gate should probe each one.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Unknown options: 'allow-build'` | An older pnpm shadows the pinned `pnpm@10.16.0` | `brew upgrade pnpm`, or remove it and let corepack own the version |
| `tsc` errors on `accounts` or `bearerTokenTargetPublicKey` | Workspace packages not built | Run `pnpm run build-all` from the repository root |
| X reports a callback error | Callback uses `localhost`, a different port, or a different path | Use exactly `http://127.0.0.1:3456/auth/x/redirect` everywhere |
| No client secret shown in the X portal | App was created as a Native or Single Page App | Recreate it as a Web App, Automated App or Bot |
| `Invalid client ID provided` from `credential-upload` | `X_CLIENT_ID` is still the placeholder | Set it in `.env.local` before uploading the secret |
| `Missing OAUTH2_CREDENTIAL_ID` or authentication fails | X client secret was not uploaded | Run `pnpm credential-upload -- '<secret>'` and copy its output to `.env.local` |
| HTTP 403 with the allocation message | Authenticated numeric X ID differs from the allocation ID | Sign in as the assigned account; never edit IDs to match a handle |
| `verified X claimant is not attached` | Allocation has not been claimed yet | Complete the browser claim first |
| `SECURITY FAILURE` before the claim completes | Backend is still sole root, and root bypasses the policy engine | Expected pre-claim; re-run the gate after handoff |
| `DENIED AS EXPECTED` | Expected post-claim backend policy denial | Treat it as a passing attack gate; investigate if signing succeeds instead |
| X authorization is unavailable or limited | X app approval is pending or permissions are wrong | Complete X approval and enable OAuth 2.0 Web App + Read permission |

## What production adds

- TTL reclaim based on the production reference pattern in [`claim-links-delegated-reclaim`](../claim-links-delegated-reclaim/)
- Durable allocation state, batch jobs, retries, idempotency locks, and X API rate-limit handling
- Post-claim passkey enrollment and recovery policies
- A target-chain transfer/deposit step gated on verification and backend attack denial
- Monitoring and alerts for claim failures, root changes, policy changes, and signing attempts
- An Option A upgrade using cold `oidcClaims` pre-registration if Turnkey confirms that lifecycle for X
