---
"@turnkey/api-key-stamper": patch
"@turnkey/sdk-browser": patch
"@turnkey/encoding": patch
---

Updates to various libraries to protect against JWK truncation:

- `@turnkey/api-key-stamper`: Add functionality for verifying and padding uncompressed public keys while generating JWK's
- `@turnkey/sdk-browser`: Use code for verifying and padding uncompressed public keys while creating passkey sessions
- `@turnkey/encoding`: Updating tests for some libraries
