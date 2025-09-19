---
"@turnkey/react-wallet-kit": patch
---

- Removed requirement of session for external wallet usage  
- `connectExternalWalletAccount()` now returns the full `WalletAccount` object instead of `void`  
- `fetchWallets()` now supports an optional `connectedOnly` parameter to fetch only connected wallets
