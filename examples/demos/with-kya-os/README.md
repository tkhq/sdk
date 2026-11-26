# KYA-OS with Turnkey signing

A Next.js App Router demo with React and Tailwind, following the compact card
and control styles in `with-mfa-and-scoped-sessions`. It uses the same Turnkey
logo, favicon, and local Inter fonts as the other web demos.

The app connects a real MCP client and server through KYA-OS. A human
issues a ten-minute delegation for `reports:read`. The agent proves possession
of its key on each call. The server checks the delegation, runs the tool, and
signs the response. Revocation blocks the next call without changing the
original credential.

The issuer, agent, and server have separate Ed25519 keys. All three sign through
`createTurnkeyBotSigner` from `@turnkey/sdk-server`. KYA-OS owns credential
formatting, canonicalization, holder binding, replay checks, and response proofs.
Credential callbacks use opaque key references. Agent and server proof identities
hold the checked SDK signer object.

The pinned pnpm patch adds an async Ed25519 proof-signing hook to KYA-OS 1.21.2.
The released proof generator imports private key material directly instead of
calling the crypto provider. The patch preserves KYA-OS's canonical payload and
existing CryptoKey path, and sends the compact JWS signing input to the SDK
signer. This patch is required for remote agent and server signing.

## Run locally

Use Node.js 22 or newer and the repository's pinned pnpm version. From the SDK
repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @turnkey/sdk-server... build
pnpm --filter @turnkey/example-with-kya-os dev
```

Open http://127.0.0.1:3017 and follow the six steps. The tool returns a synthetic
report. It does not access another system or execute a financial transaction.
The extra buttons test a request replay and an unauthorized scope.

Local mode requires no credentials and makes no Turnkey API calls. It uses
disposable, non-extractable Web Crypto keys behind a local signing client.
The SDK adapter still checks every returned signature. Restart the app to
reset its keys, delegation, and revocation state.

For a production build, run `pnpm --filter @turnkey/example-with-kya-os build`,
then `pnpm --filter @turnkey/example-with-kya-os start`. Both web commands bind
to `127.0.0.1:3017`. The Node.js route handlers keep signing and protocol state
on the server; the React client receives only public demo state and results.

## Use Turnkey test keys

Copy this directory's `.env.example` to `.env`. Set `DEMO_MODE=turnkey`, your
organization and API credentials, and three distinct existing standalone
Ed25519 key IDs:

- `TURNKEY_ISSUER_KEY_ID`: signs delegations and status lists.
- `TURNKEY_AGENT_KEY_ID`: signs per-request holder proofs.
- `TURNKEY_SERVER_KEY_ID`: signs MCP responses.

Set `TURNKEY_BASE_URL` for your test environment. The API user needs permission
to read metadata and sign with those keys. The app reads public-key metadata
at startup and keeps API credentials on the server. It does not create or
export keys. Every protocol signing operation in this mode submits a Turnkey
raw-signing activity.

## Run the walkthrough and verify a receipt

The command-line walkthrough checks consent, a successful call, an altered
response, a replayed request, and revocation. It exits nonzero if a check fails.
Run from this example directory after building the SDK:

```sh
pnpm demo artifacts/receipt.json
pnpm verify artifacts/receipt.json '<expected server DID printed by the demo>'
pnpm test
pnpm typecheck
```

The receipt contains public protocol data. Verify it promptly: live proof
verification checks timestamp skew. The verifier derives the public key from
the expected `did:key`, verifies the server's signature, and checks the exact
request and response binding. It needs no Turnkey credentials. Obtain the
expected server DID from a trusted source rather than accepting an identity
supplied with an untrusted receipt.

Successful responses and consent challenges use KYA-OS's envelope profile, which
covers the result object apart from `_meta`. Denial proofs bind the request and
authorization outcome, without a response-body hash. The UI reports that
difference when a denial is inspected. A verified response records what happened at that time.
It does not establish that the agent remains authorized after revocation.

## Example boundaries

This is a single-operator app bound to loopback. The approval button acts as the
human consent UI; it does not authenticate a person. A deployment needs its own
authenticated consent flow, durable grants and status storage, and shared
atomic replay protection. This example keeps the MCP transport, revocation
resolver, and state in one process. The status-list resolver reads the trusted
issuer-owned store directly.

The pinned `@kya-os/mcp` version follows the repository's release-age policy.
Upstream 1.21.3 fixes a `path-prefix` matcher issue in 1.21.2. This example uses
only fixed literal scopes, accepts no caller-defined scope patterns, and does
not use that matcher. Upgrade before extending the scope profile.

## References

- [KYA-OS protocol and reference implementation](https://github.com/decentralized-identity/kya-os-mcp)
- [KYA-OS consent example](https://github.com/decentralized-identity/kya-os-mcp/tree/main/examples/consent-basic)
- [Turnkey raw payload signing](https://docs.turnkey.com/api-reference/overview/raw-payload-signing)
