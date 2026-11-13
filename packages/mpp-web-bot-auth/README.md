# @turnkey/mpp-web-bot-auth

Sign outbound HTTP requests for MPP (`mppx`) identity with a dedicated Ed25519
bot key held in Turnkey, or with an injected byte-signing callback.

This package covers one narrow profile: the MPP HTTPS-directory Web Bot Auth
profile. It signs `@authority` and `Signature-Agent` only. It is not a general
RFC 9421 or Web Bot Auth library.

The private bot key stays with the signer. The package does not accept API
private keys, read environment variables, or choose how your application
authenticates to Turnkey.

## Use an authenticated Turnkey client

Pass an existing authenticated SDK client. Its `signRawPayload` method must
return the completed activity's `r` and `s` fields, as the SDK convenience
clients do. Authentication and session lifetime remain application decisions.

```ts
import {
  createTurnkeyBotSigner,
  createWebBotAuthProver,
  ed25519PublicKeyToJwk,
} from "@turnkey/mpp-web-bot-auth";

const sign = createTurnkeyBotSigner({
  client: authenticatedTurnkeyClient,
  organizationId,
  signWith: botKeyReference,
});

const bot = await createWebBotAuthProver({
  sign,
  // Turnkey reports Ed25519 public keys as 32 bytes of hex.
  publicKeyJwk: ed25519PublicKeyToJwk(botPublicKeyHex),
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

`ed25519PublicKeyToJwk` accepts 32 bytes of hex with or without a `0x` prefix
and throws `TypeError` for any other input.

### Request bodies and redirects

`prove` returns a new `Request` built from the original. This consumes the
original request's body: read the body from the returned request, and call
`prove` once per request. To sign a retry, build a new request.

The returned request uses `redirect: "error"`, which matches mppx's own identity
client, so a signature never follows a redirect to another URL. workerd
(Cloudflare Workers) does not support that mode. If you send the returned
request with `fetch` on its own in a Worker, the runtime rejects it.

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
`mppx` **0.17.1**, based on RFC 9421. It signs `@authority` and one dictionary
member of `Signature-Agent` (`webbot` by default), with `created`, `expires`, `keyid`,
`alg`, `nonce`, and `tag` parameters. The key ID is the public JWK's RFC 7638
SHA-256 thumbprint. Tests exercise the built package against the stock MPP
verifier, including replay and tampering failures.

The public directory must bind the configured bot origin to this public key.
The relying service decides which directories and keys it trusts. This package
does not host a directory, enroll bots, verify human identity, establish a
payment mandate, or prove that the agent runs in a TEE.

Signed requests reject redirects, and existing signature labels are preserved
or rejected on collision.

### Differences from `WebBotAuth.Client.prover`

The configuration mirrors upstream's `prover`: `scope`, `signatureAgent`,
`expiresIn`, `label` (default `webbot`) and `signatureAgentKey` (default: the
label). `prove` takes the same `ProveContext` (`created`, `nonce`, optional
`challenge`). Invalid configuration and input types throw `TypeError`, and
out-of-range numbers throw `RangeError`, as upstream does. The prover adds a
remote `sign` callback in place of a `CryptoKey`.

These checks are deliberately stricter than upstream:

- `scope` must list explicit origins. Upstream's `'*'` (any origin) is rejected.
- Destination origins must use HTTPS. Loopback HTTP (`localhost`, `127.0.0.1`,
  `[::1]`) is accepted only for local request targets. The bot directory itself
  must always use HTTPS.
- `expiresIn` must be from 1 through 60 seconds. Upstream accepts any positive
  integer.
- Ed25519 only. Each signature is verified against the configured public key
  before the request is returned.
- The prover does not declare a `headers` list. In mppx that field names
  sensitive headers (such as bearer tokens) to strip on a cross-origin redirect,
  and signature headers are not secrets.

The supported profile identifies the bot and authority. It does not bind the
method, path, query, or body. Applications must enforce operation authorization
and payment separately. Client-side origin scopes are not enclave-enforced
Turnkey policies. Use dedicated bot keys rather than issuer or payment keys.

## Develop

From the SDK root:

```sh
pnpm --filter @turnkey/mpp-web-bot-auth typecheck
pnpm --filter @turnkey/mpp-web-bot-auth build
pnpm --filter @turnkey/mpp-web-bot-auth test
```

The tests generate software keys in memory and inject a test client. They prove
format compatibility and failure handling, not live Turnkey authorization or
testnet settlement.
