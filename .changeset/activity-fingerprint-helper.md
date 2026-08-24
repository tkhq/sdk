---
"@turnkey/crypto": minor
"@turnkey/sdk-server": patch
---

Add `computeActivityFingerprint` to `@turnkey/crypto`, deriving the `sha256:<hex>` activity fingerprint from a request body. `createExportSecretsProposal` now uses it instead of building the string inline.
