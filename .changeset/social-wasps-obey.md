---
"@turnkey/react-wallet-kit": patch
---

- Fixed memory leaks in `handle*` functions
- `handleConnectExternalWallet` now returns `{ type: "connect" | "disconnect"; account?: WalletAccount }`
