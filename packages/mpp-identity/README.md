# @turnkey/mpp-identity

A Turnkey-backed Ed25519 `Signer` for the RFC 9421 identity provers in
[mppx](https://github.com/wevm/mppx). The private key stays in Turnkey. This
package only signs bytes. mppx builds the signature base and the HTTP headers.

> **Requires an mppx release whose identity provers accept a remote `Signer`
> (`key: CryptoKey | Signer`). That change is pending upstream.**

## Usage

```ts
import { WebBotAuth } from "mppx/extensions/identity/web-bot-auth";
import {
  createTurnkeySigner,
  ed25519PublicKeyToJwk,
  jwkThumbprint,
} from "@turnkey/mpp-identity";

const key = createTurnkeySigner({
  client, // an authenticated @turnkey/sdk-server or @turnkey/core client
  organizationId,
  signWith, // the Turnkey private key ID or address of an Ed25519 key
  publicKey, // that key's 32-byte Ed25519 public key in hex
});
const keyId = await jwkThumbprint(ed25519PublicKeyToJwk(publicKey));

const bot = WebBotAuth.Client.prover({
  key,
  keyId,
  scope: ["https://api.example"],
  signatureAgent: "https://bot.example",
});
```

`Tap.Client.prover` takes the same `key` and works the same way.

## Behavior

- `createTurnkeySigner` calls `signRawPayload` with the exact bytes in hex,
  `PAYLOAD_ENCODING_HEXADECIMAL` and `HASH_FUNCTION_NOT_APPLICABLE`.
- It verifies each signature against `publicKey` with WebCrypto before it
  returns it. A `signWith` that names a different key fails at once.
- It rejects an activity that is not `ACTIVITY_STATUS_COMPLETED`. A client
  error becomes a generic `Error` with the original error as `cause`.
- `onActivity` receives the activity ID of each verified signature.

## Client requirements

The client must return `r` and `s` at the top level of the `signRawPayload`
result. The `@turnkey/sdk-server` and `@turnkey/core` clients do. The raw
`@turnkey/http` `TurnkeyClient` does not, because it nests them in the
activity result.

The runtime must support Ed25519 in WebCrypto (Node.js 20 or later, and
current browsers).
