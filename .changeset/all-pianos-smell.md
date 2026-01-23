---
"@turnkey/core": patch
---

Fix mobile `setActiveSessionKey()` to JSON stringify session key. This fixes parsing errors in `getActiveSessionKey()`
