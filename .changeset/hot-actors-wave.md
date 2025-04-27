---
"@turnkey/sdk-react-native": minor
---

Added `createSessionFromEmbeddedKey` function. This allows creation of a session using a compressed embedded key stored by calling `createEmbeddedKey`. You may also optionally pass in an embedded key created seperately. Utilizing these two functions with a `createSuborg` api call allows for a '1 tap' passkey sign up flow [(example)](https://github.com/tkhq/react-native-demo-wallet/blob/ccf2d6c182b9e5c5ce98014a56b0b9f4282277c2/providers/auth-provider.tsx#L186).

Added optional `isCompressed` boolean field to the `createEmbeddedKey` function. This field is necessary for calling `createSessionFromEmbeddedKey`.
