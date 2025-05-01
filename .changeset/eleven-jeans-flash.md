---
"@turnkey/sdk-react-native": patch
---

- Eliminated a race condition in `refreshSession` that could throw:
  `TurnkeyReactNativeError: Embedded key not found when refreshing the session`
- The embedded key is now generated entirely in memory using `generateP256KeyPair`
- Removed the need to store and immediately retrieve the private key from secure storage

- `refreshSession` now accepts an optional parameter object
