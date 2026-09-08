---
"@turnkey/core": patch
---

Fixed `ethSendTransaction` to respect the per-call `stampWith` instead of falling back to the client default stamper
