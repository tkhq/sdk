---
"@turnkey/core": patch
---

Scope keychain storage to Turnkey keys by prefixing service names. This fixes an issue where `clearUnusedKeyPairs()` was deleting non-Turnkey keychain entries.
