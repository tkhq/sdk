---
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
"@turnkey/react-native-wallet-kit": minor
---

Add Solana multi-signer transaction support to the core client and wallet kits.

`@turnkey/core` exposes separate `solSendTransaction` and `solSendTransactionV2` wrappers. Both submit to `/public/v1/submit/sol_send_transaction`; the v1 wrapper sends `ACTIVITY_TYPE_SOL_SEND_TRANSACTION` with `signWith`, while the v2 wrapper sends `ACTIVITY_TYPE_SOL_SEND_TRANSACTION_V2` with ordered `signWiths`.
