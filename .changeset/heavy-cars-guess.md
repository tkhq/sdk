---
"@turnkey/viem": minor
---

Support awaiting consensus and improve error handling

- Add new error types that extend `BaseError` (and thus implement `error.walk`)
  - `TurnkeyConsensusNeededError` wraps consensus-related errors
  - `TurnkeyActivityError` wraps base Turnkey errors
- Add a few new helper functions:
  - `serializeSignature` serializes a raw signature
  - `isTurnkeyActivityConsensusNeededError` and `isTurnkeyActivityError` use `error.walk` to check the type of a Viem error
