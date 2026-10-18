---
"@turnkey/react-native-wallet-kit": minor
---

- Added external wallet support via WalletConnect. Pass a `walletConfig` to `TurnkeyProvider` to log in or sign up with an external wallet (Ethereum and Solana), or connect one to an existing account
- Added `walletProviders`, `connectWalletAccount`, `disconnectWalletAccount`, `loginOrSignupWithWallet` and the other wallet methods to `useTurnkey()`
- Added `createSuborgParams.walletAuth` to customize sub-orgs created through wallet signup
- Added `buildWalletConnectAppEntries`, which returns the WalletConnect wallet apps that can be opened on mobile
- Activity errors are now rethrown as is instead of being wrapped in a generic `TurnkeyError`, matching `@turnkey/react-wallet-kit`
