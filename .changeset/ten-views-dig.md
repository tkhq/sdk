---
"@turnkey/core": patch
---

- Fixed signMessage() to respect the provided encoding override instead of silently ignoring it
- Corrected Ethereum message prefixing for embedded wallets in `signMessage()` to fully align with EIP-191 standards
