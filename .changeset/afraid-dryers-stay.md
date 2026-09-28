---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/http": minor
---

Add wallet authenticators: `VERIFY_WALLET_AUTHENTICATOR` (SIWE/SIWS) and `signupV3` with `walletAuthenticators`. Wallet login uses an attested stamp bound to that verification; existing EOA API-key accounts still log in.
