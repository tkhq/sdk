---
"@turnkey/react-wallet-kit": patch
"@turnkey/react-native-wallet-kit": patch
---

Internal state refreshes no longer inherit the caller's `stampWith`. When a valid session exists, the refresh that follows a write is now stamped with the session's API key, so passing `stampWith: StamperType.Passkey` to methods like `addPasskey`, `updateUserName`, `createWallet` or `exportWallet` no longer costs an extra passkey prompt for each request the refresh makes. With no valid session the caller's stamper is still used, so setups without a session are unaffected.
