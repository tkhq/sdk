---
"@turnkey/core": minor
"@turnkey/http": minor
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
---

Add Solana send-transaction v2 support for transactions requiring multiple Turnkey signers.

The generated clients now expose separate `solSendTransaction` and `solSendTransactionV2` wrappers. Both submit to `/public/v1/submit/sol_send_transaction`; the v1 wrapper sends `ACTIVITY_TYPE_SOL_SEND_TRANSACTION` with `signWith`, while the v2 wrapper sends `ACTIVITY_TYPE_SOL_SEND_TRANSACTION_V2` with ordered `signWiths`.
