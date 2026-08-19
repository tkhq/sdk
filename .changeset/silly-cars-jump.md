---
"@turnkey/core": patch
---

Fixed `ethSendTransaction` and the transaction-status polling used by `pollTransactionStatus` ignoring an explicit `stampWith` and falling back to the client's default stamper. Callers who passed `stampWith` (e.g. to require a passkey) were previously signed with the default stamper instead.
