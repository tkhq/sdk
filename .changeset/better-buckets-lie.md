---
"@turnkey/core": patch
---

Fix missing `return` statements on `withTurnkeyErrorHandling` in `storeSession`, `clearSession`, `clearAllSessions`, `logout`, and `clearUnusedKeyPairs`, ensuring errors are properly propagated and local storage write complete before returning
