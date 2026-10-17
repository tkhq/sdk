---
"@turnkey/react-wallet-kit": patch
---

- Fixed the WalletConnect listener checking for a `pairingExpired` event that is never emitted. When a pairing link expires or a connection is rejected, only the wallet providers are refreshed now instead of every wallet, matching `@turnkey/react-native-wallet-kit`
- Fixed restoring connected wallets after WalletConnect initializes. Only WalletConnect wallets are checked now instead of every connected wallet, matching `@turnkey/react-native-wallet-kit`
- `refreshWallets` no longer fails when both wallet auth and wallet connecting are disabled, matching `@turnkey/react-native-wallet-kit`
