---
"@turnkey/core": patch
---

Add a 1-second timeout to external wallet provider discovery. This prevents hanging providers from blocking `fetchUser()` and `fetchWallet()`
