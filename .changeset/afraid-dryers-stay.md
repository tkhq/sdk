---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/http": minor
---

Add wallet authenticators: `VERIFY_WALLET_AUTHENTICATOR` (SIWE/SIWS) issues a verification token (`v1VerificationClaims`), and `signupV3` accepts `walletAuthenticators`. Wallet login uses an attested stamp bound to that token. existing legacy API-key wallet accounts still log in.
