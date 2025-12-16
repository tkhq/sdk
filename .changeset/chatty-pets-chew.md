---
"@turnkey/react-native-wallet-kit": minor
---

Add support for high-level Ethereum transaction utilities:

- **`ethSendTransaction`** — new helper used as a dedicated method for submitting Ethereum transactions (sign and broadcast) via the Turnkey API.
- **`pollTransactionStatus`** — new helper for polling Turnkey’s transaction status endpoint until the transaction reaches a terminal state.

These methods enable a clean two-step flow:

1. Submit the transaction intent using `ethSendTransaction`, receiving a `sendTransactionStatusId`.
2. Poll for completion using `pollTransactionStatus` to retrieve the final on-chain transaction hash and execution status.
