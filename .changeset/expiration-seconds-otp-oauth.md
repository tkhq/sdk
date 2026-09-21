---
"@turnkey/react-native-wallet-kit": patch
"@turnkey/react-wallet-kit": patch
"@turnkey/core": patch
---

Fixed `sessionExpirationSeconds` from the auth proxy config being ignored in the OTP and OAuth `signUp`/`complete` flows. These now auto-populate `expirationSeconds` from the config

Added an optional `expirationSeconds` param to `completeOtp`, `signUpWithOtp`, `completeOauth`, and `signUpWithOauth`
