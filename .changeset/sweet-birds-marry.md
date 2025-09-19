---
"@turnkey/core": patch
---

- Removed requirement of session for external wallet usage
- `connectExternalWalletAccount()` now returns the wallet address instead of `void`
- `fetchWallets()` now supports an optional `connectedOnly` parameter to fetch only connected wallets
