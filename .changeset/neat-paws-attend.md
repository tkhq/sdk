---
"@turnkey/core": patch
---

- Fixed `signTransaction` responses for Ethereum embedded wallets to include the `0x` prefix on returned signatures
- Fixed an issue in `signAndSendTransaction` where Ethereum embedded wallet transactions failed during broadcast due to missing `0x` prefixes
