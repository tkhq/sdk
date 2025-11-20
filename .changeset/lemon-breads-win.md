---
"@turnkey/core": patch
---

Fixed legacy transaction usage in signAndSendTransaction for **Connected wallets**. This does not affect Turnkey's embedded wallet flow, previously, connected wallet transactions were all formatted into EIP-1559 transactions, updated to respect legacy + future formats passed in.
