---
"@turnkey/core": minor
"@turnkey/http": minor
"@turnkey/react-native-wallet-kit": minor
"@turnkey/react-wallet-kit": minor
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
---

Add Solana send-transaction v2 support for transactions requiring multiple Turnkey signers.

The generated clients now expose `solSendTransactionV2`, which submits ordered `signWiths` to `/public/v1/submit/sol_send_transaction_v2`. The higher-level `solSendTransaction` helper selects v2 when `signWiths` is provided while preserving the original `signWith` request path for existing single-signer integrations.
