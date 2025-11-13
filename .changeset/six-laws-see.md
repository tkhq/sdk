---
"@turnkey/core": minor
---

- Parallelized stamper and session initialization
- Separated WalletConnect initialization from client init
- Optimized `fetchWallet` by reducing redundant queries and running wallet/user fetches in parallel
- Added optional `authenticatorAddresses` param to `fetchWalletAccounts()`
- Updated to latest `@walletconnect/sign-client` for performance improvements
