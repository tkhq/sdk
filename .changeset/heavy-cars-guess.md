---
"@turnkey/viem": minor
---

Support awaiting consensus and improve error handling

- Add new error types that extend `BaseError` (and thus implement `error.walk`)
  - `TurnkeyConsensusNeededError` wraps consensus-related errors
  - `TurnkeyActivityError` wraps base Turnkey errors
- Add a few new helper functions:
  - `getSignatureFromActivity` returns the signature corresponding to a completed activity
  - `getSignedTransactionFromActivity` returns the signed transaction corresponding to a completed activity
  - `serializeSignature` serializes a raw signature
  - `isTurnkeyActivityConsensusNeededError` and `isTurnkeyActivityError` use `error.walk` to check the type of a Viem error
