# @turnkey/mpp-web-bot-auth

Sign outbound HTTP requests for MPP (`mppx`) identity with a dedicated Ed25519
bot key held in Turnkey, or with an injected byte-signing callback.

This package covers one narrow profile: the MPP HTTPS-directory Web Bot Auth
profile. It signs `@authority` and `Signature-Agent` only. It is not a general
RFC 9421 or Web Bot Auth library.

The private bot key stays with the signer. The package does not accept API
private keys, read environment variables, or choose how your application
authenticates to Turnkey.

The first planned npm release is **0.1.0**. This package follows the SDK's
Changesets release flow and produces CommonJS, ESM, and TypeScript declarations.

## Use an authenticated Turnkey client

Pass an existing authenticated SDK client. Its `signRawPayload` method must
return the completed activity's `r` and `s` fields, as the SDK convenience
clients do. Authentication and session lifetime remain application decisions.

```ts
import {
  createTurnkeyBotSigner,
  createWebBotAuthProver,
} from "@turnkey/mpp-web-bot-auth";

const sign = createTurnkeyBotSigner({
  client: authenticatedTurnkeyClient,
  organizationId,
  signWith: botKeyReference,
});

const bot = await createWebBotAuthProver({
  sign,
  publicKeyJwk: botPublicJwk,
  signatureAgent: "https://bot.example",
  scope: ["https://api.example"],
});

const signed = await bot.prove(new Request("https://api.example/report"));
const response = await fetch(signed);
```

The bot key is Ed25519. `createTurnkeyBotSigner` submits the exact signature-base
bytes using hexadecimal encoding and `HASH_FUNCTION_NOT_APPLICABLE`, then joins
`r || s`. A pending, rejected, or failed activity produces no signed request.
The prover verifies each returned signature against the configured public JWK.

For another signer, pass `sign: async (bytes) => signatureBytes` directly.
The callback must return a 64-byte Ed25519 signature over those exact bytes.

## Use with MPP

The returned object structurally implements MPP's `Identity.Prover` interface.
MPP remains an application dependency; this SDK package has no runtime MPP or
payment dependency.

```ts
import { Mppx, tempo } from "mppx/client";

const client = Mppx.create({
  identity: [bot],
  methods: [tempo.charge({ account: payerAccount })],
  polyfill: false,
});
```

MPP supplies a fresh attempt context for each request and paid retry. Standalone
`bot.prove(request)` calls generate their own timestamp and random nonce.

## Protocol and trust boundaries

This is the narrow HTTPS-directory Web Bot Auth profile interoperable with
`mppx` **0.17.1**, based on RFC 9421. It signs `@authority` and the `webbot`
dictionary member of `Signature-Agent`, with `created`, `expires`, `keyid`,
`alg`, `nonce`, and `tag` parameters. The key ID is the public JWK's RFC 7638
SHA-256 thumbprint. Tests exercise the built package against the stock MPP
verifier, including replay and tampering failures.

The public directory must bind the configured bot origin to this public key.
The relying service decides which directories and keys it trusts. This package
does not host a directory, enroll bots, verify human identity, establish a
payment mandate, or prove that the agent runs in a TEE.

Signatures last at most 60 seconds. Destination scopes are explicit HTTPS
origins; loopback HTTP is accepted only for local request targets. The bot
directory itself must use HTTPS. Signed requests reject redirects, and existing
signature labels are preserved or rejected on collision.

The supported profile identifies the bot and authority. It does not bind the
method, path, query, or body. Applications must enforce operation authorization
and payment separately. Client-side origin scopes are not enclave-enforced
Turnkey policies. Use dedicated bot keys rather than issuer or payment keys.

## Develop and release

From the SDK root:

```sh
pnpm --filter @turnkey/mpp-web-bot-auth typecheck
pnpm --filter @turnkey/mpp-web-bot-auth test
pnpm --filter @turnkey/mpp-web-bot-auth build
pnpm --filter @turnkey/mpp-web-bot-auth pack --pack-destination /tmp
```

The tests generate software keys in memory and inject a test client. They prove
format compatibility and failure handling, not live Turnkey authorization or
testnet settlement. Before npm publication, a demo can consume the built `.tgz`
artifact. Keep that artifact outside git and record its SHA-256 in demo evidence.

Release through the normal SDK release PR and npm workflow. Adding the package
does not itself publish it or provision any bot keys or credentials.
