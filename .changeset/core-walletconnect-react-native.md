---
"@turnkey/core": patch
---

Fixed WalletConnect failing to start in React Native (`SignClient.init is not a function`). Also fixed WalletConnect getting stuck after a rejected or failed connection, or after the wallet disconnects: a new pairing link is now created so the next connection attempt works without restarting the app.
