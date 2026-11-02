---
"@turnkey/core": patch
"@turnkey/sdk-server": patch
---

`pollTransactionStatus` now rejects when a transaction is `INCLUDED` with an error. A transaction that reverts on-chain is in a block, so it reports `INCLUDED` and carries its error; it previously resolved as if it had succeeded.
