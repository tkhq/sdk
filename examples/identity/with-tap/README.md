# Turnkey + TAP agent recognition

Use the checked `createTurnkeyBotSigner` adapter with mppx's Trusted Agent
Protocol (TAP) prover. Mppx owns HTTP signatures, intent tags, signing contexts,
origin scopes, and verification. This example adds no protocol implementation
or reusable SDK wrapper.

## Status

This example needs mppx remote-signer support, which is not released yet.
Published mppx 0.18.1 accepts only a `CryptoKey`. The upstream change is
proposed in https://github.com/wevm/mppx/issues/1283. When mppx releases it,
add `mppx` to `dependencies` and run:

```sh
pnpm --filter @turnkey/sdk-server... build
pnpm --filter @turnkey/example-tap demo
pnpm --filter @turnkey/example-tap test:tap
pnpm --filter @turnkey/example-tap typecheck:tap
```

The demo uses a disposable software key and a test client that returns the
Turnkey raw-signing response shape. The agent and merchant run in one process
over an in-memory transport. It makes no Turnkey API request, payment, or
network call.

## Use a real Turnkey client

Pass an already authenticated client rather than loading a private API key in
this example:

```ts
import { createTurnkeyBotSigner } from "@turnkey/sdk-server";
import * as Tap from "mppx/extensions/identity/tap";
import * as Identity from "mppx/identity";

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
