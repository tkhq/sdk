---
"@turnkey/react-native-wallet-kit": patch
"@turnkey/react-wallet-kit": patch
---

Added `storeOAuthState`, `consumeOAuthState`, and `hasOAuthState` utilities and wired them into `buildOAuthUrl` and `parseInAppBrowserResult` to add OAuth CSRF state validation.
