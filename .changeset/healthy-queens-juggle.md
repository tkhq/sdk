---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-react": minor
---

Deprecate the `getAuthBundle()` path for passkey sessions and replace it with `getReadWriteSession()` to store authBundles with their expirationTimestamps so applications can better manually manage active writing sessions
