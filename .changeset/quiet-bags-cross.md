---
"@turnkey/core": patch
---

- Fixed errors not being deserialized in `withTurnkeyErrorHandling()`, which previously caused them to stringify as `[object Object]`
- Improved error messages surfaced by `connectWalletAccount()`
