---
"@turnkey/core": minor
"@turnkey/http": major
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": major
"@turnkey/sdk-types": minor
---

Add Solana send-transaction v2 support for transactions requiring multiple Turnkey signers.

`@turnkey/core` exposes separate `solSendTransaction` and `solSendTransactionV2` wrappers. Both submit to `/public/v1/submit/sol_send_transaction`; the v1 wrapper sends `ACTIVITY_TYPE_SOL_SEND_TRANSACTION` with `signWith`, while the v2 wrapper sends `ACTIVITY_TYPE_SOL_SEND_TRANSACTION_V2` with ordered `signWiths`.

The generated `@turnkey/sdk-server` and `@turnkey/sdk-browser` clients now use the v2 request and response shape through `solSendTransaction`, matching the versioning behavior of other generated activity methods.
