---
"@turnkey/react-wallet-kit": minor
"@turnkey/core": minor
---

- Added `sendSignedRequest()` to execute any `TSignedRequest` returned by SDK stamping methods.
- Added `buildWalletLoginRequest()` method, which prepares and signs a wallet login request without sending it to Turnkey, returning the `stampLogin` signed request alongside the wallet’s public key used for login.
