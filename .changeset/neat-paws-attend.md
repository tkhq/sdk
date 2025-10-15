---
"@turnkey/core": patch
---

Fixed an issue in `signAndSendTransaction` where Ethereum embedded wallet transactions failed during broadcast due to missing `0x` prefixes
