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

## What Turnkey provides here

Turnkey documents [claim links](https://docs.turnkey.com/features/wallets/claim-links) as a first-class pattern: you can hold value in a wallet for someone who has no account yet, and hand it over later without anyone custodying it in the meantime. That guide describes the **bearer** variant, where the claim credential travels in the URL — the model our sibling [`claim-links-delegated-reclaim`](../claim-links-delegated-reclaim/) implements. This example is the identity-bound variant of the same idea.

Four Turnkey capabilities do the work:

- **[Sub-organizations](https://docs.turnkey.com/features/sub-organizations)** give every allocation its own isolated policy and quorum boundary, so one claim can never reach another's keys.
- **[Pre-generated wallets](https://docs.turnkey.com/features/wallets/pregenerated-wallets)** mean an address exists — and can receive — before its owner has authenticated even once.
- **[OAuth 2.0 authentication](https://docs.turnkey.com/api-reference/activities/oauth-20-authentication)** has Turnkey perform the code exchange with X *inside its secure enclave* and return an OIDC token it signed itself. The claim decision rests on Turnkey's attestation of the identity, not on anything this app parsed from a redirect.
- **[The policy engine](https://docs.turnkey.com/features/policies/overview)** plus root-quorum rotation turn "the backend hands custody over" into an enforced state change rather than a promise. After handoff the claimant is the only root user, and the former backend is denied by an explicit policy on top of implicit deny.

The private key material is never in the application at any point in this flow.

## How it works

### Pre-association — `scripts/preassociate.ts`

1. Resolve each target to an immutable numeric X ID (`src/lib/xid.ts`), manually or through the X API.
2. `createSubOrganization` creates one sub-org named `allocation:claim:x:<numeric_id>:@<handle>`, with the backend API-key user as its sole root and a Solana wallet inside it. **That name is the binding**: it is what the claim gate later checks against.
3. `createPolicy` installs two latent policies from `src/lib/policies.ts`: the backend signing **deny**, and an **allow** for the backend to run `oauth_login`. Neither can bite yet — the backend is root, and root bypasses policy — hence "latent". The second exists because the backend key remains a non-root *member* of the sub-org after handoff, so Turnkey evaluates its policies when it stamps the claimant's session mint; without it, `oauth_login` is implicitly denied the instant root rotates.
4. Re-runs are idempotent: `getSubOrgIds` filtered by the backend public key, then a name match on `claim:x:<numeric_id>`.

### Claim — the three routes

1. **`src/app/auth/x/route.tsx`** builds the X authorize URL with PKCE (S256) and stores the code verifier, state, and allocation ID in `HttpOnly`, `SameSite=lax` cookies. The allocation rides through the round trip in a cookie rather than in the URL, so the claim target cannot be swapped by editing a link.
2. **`src/app/auth/x/redirect/page.tsx`** receives X's authorization code and posts it, with a target public key, to the backend route.
3. **`src/app/auth/turnkey/x/route.ts`** calls `oauth2Authenticate` with the stored credential ID and code verifier. Turnkey performs the exchange with X and returns an OIDC token whose `sub` is the bare numeric X user ID (verified live: `sub="1270562298"`, no prefix).

Then the gate, and only if it passes, the handoff:

4. `assertClaimMatches` (`src/lib/claim-gate.ts`) compares that Turnkey-issued subject against the numeric ID embedded in the allocation name. Mismatch returns HTTP 403 and nothing is mutated. A forged token cannot pass, because the subject is one Turnkey signed after talking to X itself — `pnpm test:claim-gate` exercises exactly this.
5. `createUsers` creates the claimant **with the X provider attached in the same call** — Turnkey rejects a user with no credential (`user missing valid credential`), so a separate `createOauthProviders` step can never work. `createPolicy` then installs a signing allow scoped to that concrete user ID.
6. `updateRootQuorum` sets the root quorum to the claimant alone. This is the moment custody actually moves: the backend stops being root, and the deny from step 3 becomes enforceable against it.
7. `oauthLogin` returns a session for the claimant, and the dashboard opens.

### Verification

`pnpm demo:verify` re-reads the sub-org and asserts the post-conditions independently of the app: the X provider is attached to a user, the root quorum is exactly that user, and both signing policies are present (it warns if the backend `oauth_login` allow is missing, which only happens on allocations that pre-date it). `pnpm attack` then tries to actually sign with the demoted backend credential and requires a policy denial.

## Prerequisites

Budget roughly 30 minutes, plus however long X takes to approve your developer application.

| | Why |
| --- | --- |
| A Turnkey organization and a P-256 API keypair | Becomes each allocation's temporary backend root |
| One X account you control | The claimant. The 403 rejection is shown by trying to claim an allocation bound to someone *else's* numeric ID |
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

`X_LOOKUP_MODE` defaults to `manual`. Re-running pre-association reuses an existing **unclaimed** allocation for the same `claim:x:<numeric_id>`, so it is safe to run twice. Once an allocation has been claimed it belongs to the claimant; to run the demo again for the same account, pass `--reallocate` to mint a fresh one.

## Run the demo

`pnpm demo` resolves the targets and delegates to `pnpm preassociate`; use `demo` unless you want pre-association alone. Keep the `pnpm dev` terminal visible throughout: the server log narrates every Turnkey call, and it is where the diagnostics live.

**1. Allocate two sub-orgs — one for you, one you cannot claim.**

```bash
pnpm demo -- <your_handle>:<your_numeric_id>   # yours; see "Finding a numeric X ID"
pnpm demo -- turnkey:16088008                  # someone else's, for the rejection test
```

Each prints a claim URL and a Solana address:

```text
CREATED @LewellenMichael 1270562298: http://127.0.0.1:3456/claim/0447450a-…
SOLANA ADDRESS (DO NOT FUND BEFORE CLAIM GATES PASS): 4D6TnEMr8mk9…
```

Re-running prints `SKIP … (unclaimed allocation exists)`; after a claim it prints `CLAIMED … (pass --reallocate to allocate again)`.

**2. Start the app.**

```bash
pnpm dev
```

Always enter through a `/claim/<subOrgId>` URL. The welcome page at `/` has no allocation to bind to, and says so.

**3. Prove the gate rejects the wrong account.** Open the `turnkey:16088008` claim URL and authorize as yourself. Expect **Claim rejected — this allocation belongs to a different X account** (HTTP 403). The server log says why, and shows that nothing else happened:

```text
claim gate: sub="1270562298" allocation="allocation:claim:x:16088008:@turnkey" …
claim gate refused: X ID mismatch: token 1270562298 vs allocation 16088008
```

`pnpm demo:verify -- <foreignSubOrgId>` still reports `verified X claimant is not attached`: a rejection mutates nothing. Do this before the successful claim — it is the check the whole design rests on, and it is far more convincing before you have watched the happy path work.

**4. Claim yours.** Open your own claim URL and authorize. Finish the X consent screen within ten minutes; the PKCE cookies expire after that. The dashboard opens once handoff completes, and the log narrates it:

```text
claim step ok: oauth2Authenticate
claim gate: sub="1270562298" allocation="allocation:claim:x:1270562298:@LewellenMichael" …
claim step ok: createUsers
claim: created claimant 3f1bbb55-…
claim step ok: createPolicy(claimant allow)
claim step ok: updateRootQuorum        ← custody moves on this line
claim step ok: oauthLogin
```

The **User ID** on the dashboard is that claimant ID, and the wallet address is the one printed at allocation.

**5. Verify the handoff.**

```bash
pnpm demo:verify -- <subOrgId>
```

```text
VERIFIED CLAIM: <subOrgId> -> X 1270562298 -> 3f1bbb55-…
```

Read back from Turnkey independently of the app: the X provider is attached to a user, root quorum is exactly that user, and the signing deny and allow are both present. Before a claim this correctly fails with `verified X claimant is not attached`.

**6. Run the adversarial gate.**

```bash
pnpm attack -- <subOrgId>
```

```text
DENIED AS EXPECTED (explicit deny policy fired): Turnkey error 7: You don't have sufficient permissions to take this action. …
```

This uses the *same API key that was root of this sub-org one step ago* and asks Turnkey to sign with the wallet. The parenthetical matters: Turnkey's details list every policy's outcome, and the gate reports whether the backend deny reached `OUTCOME_DENY_EXPLICIT` (as above) or the request was only implicitly denied, which would mean the deny policy is missing. The gate passes only when it prints `DENIED AS EXPECTED` and exits 0; a successful signature is a security failure and exits 1.

**Before claim, this command prints `SECURITY FAILURE`, and that is the expected result.** The backend is still sole root, and root quorum bypasses the policy engine, so the latent deny cannot yet be enforced. A pre-claim run tells you nothing except that the boundary described below is real — which is precisely why funds must wait.

**7. Only now move value**, if you are going that far.

Each allocation creates a Turnkey sub-organization that cannot be deleted, so repeated runs accumulate them in your organization. Unclaimed allocations are reused automatically; use `--reallocate` only when you deliberately want a fresh one after a claim.

### Presenting this in five minutes

If you are showing this rather than testing it, the order above is the talk track. Keep the server log on screen.

1. *"An address exists for this X account before they have ever logged in."* Show the allocation output and the address.
2. *"Nobody else can take it."* The foreign allocation's rejection, with `X ID mismatch` in the log.
3. *"The owner claims it with an ordinary X login."* The consent screen, then the seven log lines. Pause on `updateRootQuorum`: that line is custody moving.
4. *"And we, the operator, are now locked out."* `pnpm attack`. The key that created the wallet cannot sign with it.
5. Close on the funding rule: value moves only after step 4 passes, because until root rotates, Turnkey's own root-bypass rule means no policy can bind the operator. That is not a limitation of the demo; it is the property that makes the handoff trustworthy.

## Security model and an important boundary

Turnkey root-quorum users bypass the policy engine. The API-key backend must temporarily be the sole root to create the claimant, attach OAuth, install the claimant policy, and hand over root. Consequently, **no policy can deny that key from signing before handoff**. This demo creates an explicit backend signing-deny policy during pre-association, but it becomes enforceable only after the claimant replaces the backend in root quorum. Do not fund a pre-associated address. Transfer or deposit value only after `pnpm demo:verify` and `pnpm attack` both pass.

The sibling [`claim-links-delegated-reclaim`](../claim-links-delegated-reclaim/) example can demote a bootstrap key before use because it starts with two roots. Its order is: create the claim and sweep users as roots, let the sweep root install its policy, then remove only the sweep user from root quorum. This example starts with one backend root because the future claimant does not exist before X authentication. Turnkey does not permit an empty root quorum, so the backend cannot self-demote before the verified claimant is ready to replace it. That difference forces the latent-deny and fund-only-after-claim sequence.

The policy language does not expose a dependable “has an X provider” approver predicate. The claim route therefore installs a signing allow bound to the exact claimant user ID after verifying the Turnkey-issued `sub`. Recovery that replaces the user must deliberately replace this policy.

## Why funds move only at claim

Pre-association creates an address for a numeric X ID, but the operator must not fund it while the backend remains temporary root. The claim gate compares the Turnkey-issued numeric subject with the ID embedded in the allocation name, so handle changes and handle squatting do not redirect an allocation. A successful match creates the claimant, attaches that X identity, installs a claimant-specific signing allow, and rotates root quorum exclusively to that claimant. The previously installed deny then policy-blocks the demoted backend key from raw signing. Funds move to the verified address only after the post-claim verification and adversarial signing gate pass.

## Relationship to claim-links-delegated-reclaim

Both examples build [claim links](https://docs.turnkey.com/features/wallets/claim-links) with per-allocation Turnkey sub-organizations, but they grant the right to claim differently. The bearer model is the one Turnkey's own guide describes; the identity-bound model trades the ability to forward a link for a guarantee about who ends up holding the wallet.

| | [Bearer-link model](../claim-links-delegated-reclaim/) | Identity-bound model (this example) |
| --- | --- | --- |
| Right to claim | Possession of a claim key in the URL fragment | Control of the allocated numeric X account |
| Gate | The fragment secret is the credential; possession grants the claim | Turnkey verifies the numeric X ID in its enclave during OAuth |
| Forwarding risk | A recipient can leak or forward the bearer secret | There is no bearer claim secret to leak or forward |
| Expiry and reclaim | Claim-key TTL plus a sweep key for automatic return to the sender | Not implemented; value must arrive only after claim gates pass |
| Policy bootstrap | Delegated Access with two roots; the sweep key installs its policy and demotes itself | One temporary backend root; its signing deny is latent until claimant root rotation |

## Policy expressions

See the heavily commented reusable documents in `src/lib/policies.ts`. Three policies: the backend signing **deny** and the claimant signing **allow** are both conditioned on `activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'`, bound respectively to the concrete backend and claimant user IDs; the backend **`oauth_login` allow** is conditioned on `ACTIVITY_TYPE_OAUTH_LOGIN` and lets the demoted backend keep minting the claimant's sessions without regaining any signing ability. With no other allow policy, non-root activity is default-denied.

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
| HTTP 403 with the allocation message | Authenticated numeric X ID differs from the allocation ID (step 3 does this on purpose) | Open *your* allocation's URL; never edit IDs to match a handle |
| `Missing claim allocation` | Flow started from `/` or `/dashboard`, not a claim URL, or the cookie expired | Open the `/claim/<subOrgId>` URL and start again |
| `Missing PKCE verifier` | More than ten minutes on the X consent screen; the PKCE cookies expired | Reopen the claim URL and authorize promptly |
| `verified X claimant is not attached` | Allocation has not been claimed yet | Complete the browser claim first |
| `user missing valid credential: <id>` from `createUsers` | A user was created with no credential; the X provider must be attached in the same call | Already fixed in this example; if you fork the route, keep `oauthProviders` inline |
| `oauth_login` denied with `OUTCOME_DENY_IMPLICIT` after handoff | Sub-org pre-dates the backend `oauth_login` allow policy; the demoted backend cannot add it | Allocate afresh — the claimant now holds root and the old allocation is otherwise intact |
| `SECURITY FAILURE` before the claim completes | Backend is still sole root, and root bypasses the policy engine | Expected pre-claim; re-run the gate after handoff |
| `DENIED AS EXPECTED` | Expected post-claim backend policy denial | Treat it as a passing attack gate; investigate if signing succeeds instead |
| X authorization is unavailable or limited | X app approval is pending or permissions are wrong | Complete X approval and enable OAuth 2.0 Web App + Read permission |

## What production adds

- TTL reclaim based on the production reference pattern in [`claim-links-delegated-reclaim`](../claim-links-delegated-reclaim/)
- Durable allocation state, batch jobs, retries, idempotency locks, and X API rate-limit handling
- Post-claim passkey enrollment and recovery policies
- A target-chain transfer/deposit step gated on verification and backend attack denial
- Monitoring and alerts for claim failures, root changes, policy changes, and signing attempts
- Nothing that removes the temporary-root phase. Turnkey's `oidcClaims` pre-registration was checked as a way to make the claimant root from day one; it registers *additional audiences* for an identity already proven by an accompanying `oidcToken` in the same request, so it cannot register a claimant cold from a numeric ID. The latent-deny sequence is forced by the platform, not chosen for convenience.
