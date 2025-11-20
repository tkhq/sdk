---
"@turnkey/core": patch
---

Fixed legacy transactions not working in `signAndSendTransaction()` for **EVM connected wallet**. This does not affect Turnkey's embedded wallet flow, previously, connected wallet transactions were all formatted into EIP-1559 transactions, updated to respect legacy + future formats passed in.
