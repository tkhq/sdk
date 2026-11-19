---
"@turnkey/core": patch
"@turnkey/react-wallet-kit": patch
---

Concurrent logins no longer delete each other's key pairs.

- `storeSession` and `clearSession` only delete a session's key pair if no other stored session uses it.
- `storeSession` now throws `STORE_SESSION_ERROR` if the session's public key isn't in the local key store.
