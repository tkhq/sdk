---
"@turnkey/sdk-server": minor
---

Add `createTurnkeyBotSigner`, an Ed25519 remote signer for HTTP message signature
provers. It uses an authenticated Turnkey client and verifies each returned
signature against the configured public key. Request serialization and prover
behavior remain with the consuming library.

Add `createTurnkeyEs256Signer` for P-256/SHA-256 signing. It sends the original
message bytes for SHA-256 hashing in Turnkey and returns a checked, fixed-width
64-byte ECDSA signature suitable for JOSE ES256 and HTTP message signing.

Also add `ed25519PublicKeyToJwk`, `p256PublicKeyToJwk` and `jwkThumbprint` for
public Ed25519 and P-256 keys. P-256 conversion accepts compressed or uncompressed
SEC1 points, and thumbprints follow RFC 7638 using only required public members.

Failed signing requests throw `TurnkeySigningError`, with a `code`, and the
`activityId` and `activityStatus` when Turnkey reports them. The adapters
return a signature only when the activity status is `ACTIVITY_STATUS_COMPLETED`.
