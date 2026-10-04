---
"@turnkey/core": patch
---

`buildWalletConnectAppEntries` now checks each configured chain separately, so wallets that support only some of the configured chains are included for the chains they support. For example, MetaMask is now offered for Ethereum when both Ethereum and Solana are configured, instead of being hidden. Wallets that only support the discontinued WalletConnect v1 protocol are no longer included, since they can't connect.
