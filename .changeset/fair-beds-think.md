---
"@turnkey/react-wallet-kit": patch
"@turnkey/react-native-wallet-kit": patch
---

Fixed OAuth state validation to reject missing, tampered, and mismatched state parameters, and to always clean up stored state after validation attempts.
