---
"@turnkey/react-wallet-kit": patch
---

Keep session expiry scoped to the expired session. Avoid a second logout after
clearing it, and remove session-list entries from the latest state so older
timers and concurrent cleanup cannot discard or restore other sessions.
