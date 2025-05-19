---
"@turnkey/sdk-react-native": minor
---

Added support for React 19

Renamed `sessionKey` parameter to `storageKey` in `createEmbeddedKey` `saveEmbeddedKey` and `getEmbeddedKey`.

Added optional `embeddedStorageKey` parameter to `createSession`. This allows for retrieval of the embedded key from a custom location in secure storage.
