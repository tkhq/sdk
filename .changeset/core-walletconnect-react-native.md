---
"@turnkey/core": patch
---

- Fixed WalletConnect failing to start in React Native (`SignClient.init is not a function`)
- Fixed WalletConnect getting stuck after a rejected/failed connection or after the wallet disconnects. A new pairing link is now created so the next connection attempt works without restarting the app
- WalletConnect now initializes in the background in React Native, matching web, so it no longer delays client initialization
- `disconnectWalletAccount` no longer throws when the wallet was disconnected but a new pairing link couldn't be created
