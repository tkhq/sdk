---
"@turnkey/sdk-server": patch
---

Type the remote signers' `publicKey` as the global `CryptoKey` instead of
Node's `webcrypto.CryptoKey`. With recent `@types/node`, Node's type has key
usages that the DOM type lacks, so the signer was not assignable to mppx's
identity `Signer`.
