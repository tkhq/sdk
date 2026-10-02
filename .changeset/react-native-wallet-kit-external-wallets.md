---
"@turnkey/react-native-wallet-kit": minor
---

Add external wallet support via WalletConnect. Pass a `walletConfig` to `TurnkeyProvider` to log in or sign up with an external wallet (Ethereum and Solana), or connect one to an existing account. Adds `walletProviders`, `connectWalletAccount`, `disconnectWalletAccount`, `loginOrSignupWithWallet` and the other wallet methods to `useTurnkey()`, and `createSuborgParams.walletAuth` to customize sub-orgs created through wallet signup.
