---
"@turnkey/http": major
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": major
---

Add Solana send-transaction v2 support for transactions requiring multiple Turnkey signers.

The generated `@turnkey/sdk-server` and `@turnkey/sdk-browser` clients now use the v2 request and response shape through `solSendTransaction`, matching the versioning behavior of other generated activity methods.
