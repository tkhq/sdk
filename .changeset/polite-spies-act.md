---
"@turnkey/react-native-wallet-kit": patch
"@turnkey/react-wallet-kit": patch
---

- Added `autoFetchWalletKitConfig` option to the `TurnkeyProvider` config. Setting this to false will disable the initial `walletKitConfig` fetch, saving on initialization time. If this is disabled and you want to use the `handleLogin` modal with Turnkey's Auth Proxy, you must pass in the enabled auth methods manually into the `TurnkeyProvider` config.

- Fixed `refreshWallets` and `refreshUser` not working when `autoRefreshManagedState` is disabled.
