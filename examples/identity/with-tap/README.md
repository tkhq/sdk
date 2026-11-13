# Turnkey + TAP agent recognition

Use the checked `createTurnkeyBotSigner` adapter with mppx's Trusted Agent
Protocol (TAP) prover. Mppx owns HTTP signatures, intent tags, signing contexts,
origin scopes, and verification. This example adds no protocol implementation
or reusable SDK wrapper.

## Run the offline example

From the SDK root, use the Node version in `.nvmrc` and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm --filter @turnkey/sdk-server... build
pnpm --filter @turnkey/example-tap prepare:mppx
pnpm --filter @turnkey/example-tap demo
pnpm --filter @turnkey/example-tap test:tap
pnpm --filter @turnkey/example-tap typecheck:tap
```

The demo uses a disposable software key and a test client that implements the
Turnkey raw-signing response shape. The agent and merchant run in one process;
requests use an in-memory transport. No Turnkey API request, payment, or network
service is involved. Output reports recognized `browse` and `payment` intents
without printing signatures or request credentials.

Published mppx **0.18.1 does not yet accept remote signing keys**. The explicit
`prepare:mppx` command checks out public upstream commit
`f253219dd2ee4702c7917e288845bd3b1d70cb25`, applies the reviewed source patch in
`patches/mppx-remote-signers.patch`, and checks its SHA-256 plus the resulting
source diff. The patch comes from locally tested upstream commit
`0ac640fa28081d2656ecf62016fcc233f4b51932`; it has not been published upstream.
Setup downloads the exact pnpm 12.16.1 tool distribution, verifies its
published SHA-512, and uses upstream's frozen lockfile and unchanged dependency
policy. Git, tar, and network access are required for preparation. Generated
source and tool files stay under the SDK's ignored `.build-artifacts` directory.
Normal SDK builds do not run this external setup. Replace the patch setup with a
pinned release after upstream publishes the API.

## Use a real Turnkey client

Pass an already authenticated client rather than loading a private API key in
this example. Import `Tap` and `Identity` from the prepared runtime for now:

```ts
import { createTurnkeyBotSigner } from "@turnkey/sdk-server";
import { Tap, Identity } from "./src/runtime.mjs";

const key = createTurnkeyBotSigner({
  client: authenticatedTurnkeyClient,
  organizationId,
  signWith: agentKeyReference,
  publicKey: agentPublicCryptoKey,
});
const agent = Identity.Client.from([
  Tap.Client.prover({
    key,
    keyId: merchantRegisteredKeyId,
    intent: "browse",
    scope: ["https://merchant.example"],
  }),
]);
const { response } = await agent.send(
  fetch,
  new Request("https://merchant.example/catalog"),
);
```

The merchant must resolve the registered key ID and algorithm to a trusted
public key. Its public-key registry is an enrollment decision, not information
to trust from an arbitrary request. Use shared atomic nonce storage across
merchant replicas; the in-memory store is only for this local example. The
identity runner supplies fresh attempt contexts, enforces origin scope, and
disables redirects for signed requests.

## Meaning of the result

This profile recognizes an agent and the signed TAP intent. Its required
components are `@authority` and `@path`; it does not bind the HTTP method,
query string, or body. Operation authorization must enforce its own inputs.
Neither the browse nor payment tag establishes settlement, a spending mandate,
consumer recognition, or payment-container verification. Enforce those through
the corresponding payment and authorization services.

Tests exercise both intent tags, per-attempt freshness, shared replay state,
authority/path tampering, exact origin scope, and refusal before transport when
the signer uses the wrong key or needs approval. A boundary test demonstrates
the method/query/body limitation rather than implying stronger request binding.
