---
"@turnkey/react-native-wallet-kit": major
"@turnkey/react-wallet-kit": major
"@turnkey/core": major
---

`signUpWithPasskey` now no longer accepts an `organizationId`. This value is now taken exclusively from the config.

The `sendSignedRequest` helper function has been removed. This is replaced with `httpClient.sendSignedRequest`.
