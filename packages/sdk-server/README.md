# @turnkey/sdk-server

[![npm](https://img.shields.io/npm/v/@turnkey/sdk-server?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-server)

A SDK client with server-specific abstractions for interacting with [Turnkey](https://turnkey.com) API. Also includes [@turnkey/http](https://www.npmjs.com/package/@turnkey/http), a lower-level, fully typed HTTP client.

Turnkey API documentation lives here: https://docs.turnkey.com.

## Getting started

```bash
$ npm install @turnkey/sdk-server
```

```js
const { Turnkey } = require("@turnkey/sdk-server");

// This config contains parameters including base URLs, API credentials, and org ID
const turnkeyConfig = JSON.parse(fs.readFileSync("./turnkey.json", "utf8"));

// Use the config to instantiate a Turnkey Client
const turnkeyServerClient = new Turnkey(turnkeyConfig);

// You're all set to create a server!
const turnkeyProxyHandler = turnkeyServerClient.expressProxyHandler({});

app.post("/apiProxy", turnkeyProxyHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Helpers

`@turnkey/sdk-server` provides `Turnkey`, which offers wrappers around commonly used Turnkey API setups. This enables you to easily stand up a minimal backend to proxy end-users' requests to Turnkey. You can also use this to call on the Turnkey API directly from a server setting.

// TODO:
// - typescript-ify example
// - include nextjs server example

## Remote HTTP message signing

`createTurnkeyBotSigner` (Ed25519) and `createTurnkeyEs256Signer` (ECDSA P-256
with SHA-256) adapt an already authenticated Turnkey client to a remote signing
key. Each verifies every returned signature against your public `CryptoKey`
before returning it. Credentials remain with your client.
Verification uses the runtime's Web Crypto API (`globalThis.crypto.subtle`), so
importing the adapter adds no Node crypto dependency to browser bundles.

```ts
import {
  createTurnkeyBotSigner,
  ed25519PublicKeyToJwk,
  jwkThumbprint,
} from "@turnkey/sdk-server";
import * as WebBotAuth from "mppx/extensions/identity/web-bot-auth";

// The bot key's public key, as Turnkey returns it (32 bytes of hex).
const jwk = ed25519PublicKeyToJwk(botPublicKeyHex);
const publicKey = await crypto.subtle.importKey("jwk", jwk, "Ed25519", true, [
  "verify",
]);

const key = createTurnkeyBotSigner({
  client: authenticatedTurnkeyClient,
  organizationId,
  signWith: botKeyReference,
  publicKey,
});

// mppx derives the Web Bot Auth keyid from key.publicKey. TAP provers and
// attestation issuers can take await jwkThumbprint(jwk) as their key ID.
const bot = WebBotAuth.Client.prover({
  key,
  signatureAgent: "https://bot.example",
  scope: ["https://api.example"],
});
```

The returned object is an mppx identity `Signer` (`{ publicKey, sign({ payload }) }`),
so it works with the Web Bot Auth and TAP provers and `Attestation.sign`. This
needs the mppx release after 0.18.1 that includes remote signers. Mppx owns HTTP serialization,
covered components, headers, nonces, and target scopes; this helper owns only
Turnkey signing and the public-key check. It signs the exact supplied bytes with
`HASH_FUNCTION_NOT_APPLICABLE` and returns the Ed25519 `r || s` signature.

Pass the complete message, not a precomputed digest. Ed25519 (RFC 8032) hashes
the message inside the algorithm, so mppx passes the full RFC 9421 signature
base or JWS signing input. A signature over a digest does not verify against
the original message.

### Failures

A failed request throws `TurnkeySigningError`. Its message does not include
upstream error text. Use its fields to audit or alert:

| Field            | Contents                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `code`           | `SIGNING_REQUEST_FAILED`, `ACTIVITY_NOT_COMPLETED`, `INVALID_SIGNATURE` or `SIGNATURE_MISMATCH`            |
| `activityId`     | The Turnkey activity ID, when Turnkey reported one, for example for a policy denial or a consensus request |
| `activityStatus` | The activity status, for example `ACTIVITY_STATUS_CONSENSUS_NEEDED`                                        |
| `cause`          | The error that your client threw, if any                                                                   |

The adapter returns a signature only when the activity status is
`ACTIVITY_STATUS_COMPLETED` and the signature verifies against `publicKey`.
`onActivity` runs only after that check passes.

See [`examples/identity/with-mppx`](../../examples/identity/with-mppx) for an
end-to-end mppx demo.

### ES256 / P-256 signing

```ts
import {
  createTurnkeyEs256Signer,
  p256PublicKeyToJwk,
  jwkThumbprint,
} from "@turnkey/sdk-server";

// Compressed (33-byte) or uncompressed (65-byte) SEC1 public key in hex.
const jwk = p256PublicKeyToJwk(p256PublicKeyHex);
const publicKey = await crypto.subtle.importKey(
  "jwk",
  jwk,
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["verify"],
);
const signer = createTurnkeyEs256Signer({
  client: authenticatedTurnkeyClient,
  organizationId,
  signWith: p256KeyReference,
  publicKey,
});

const keyId = await jwkThumbprint(jwk);
const signature = await signer.sign({ payload: signingInputBytes });
```

Pass the original message bytes, or the encoded `header.payload` bytes for a
JWS. Turnkey applies SHA-256 once through `HASH_FUNCTION_SHA256`; do not pass
a precomputed digest. The adapter pads each ECDSA scalar to 32 bytes and returns
the 64-byte IEEE P1363 `r || s` encoding used by JOSE ES256 and RFC 9421.
It returns `algorithm: "ecdsa-p256-sha256"`, the HTTP signature algorithm name;
JOSE consumers use `alg: "ES256"` in their protected header.

The ES256 adapter does not add P-256 support to mppx's Web Bot Auth or TAP
provers. Those consumers must support the algorithm separately. JWT headers,
claims, HTTP serialization and protocol verification belong to the consuming
library. Raw signing policy does not inspect or enforce those fields.
