# @turnkey/sdk-react-native

## 1.3.1

### Patch Changes

- Updated dependencies [[`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a), [`10ee5c5`](https://github.com/tkhq/sdk/commit/10ee5c524b477ce998e4fc635152cd101ae5a9cc), [`593de2d`](https://github.com/tkhq/sdk/commit/593de2d9404ec8cf53426f9cf832c13eefa3fbf2)]:
  - @turnkey/encoding@0.5.0
  - @turnkey/crypto@2.4.0
  - @turnkey/http@3.4.1
  - @turnkey/api-key-stamper@0.4.6
  - @turnkey/react-native-passkey-stamper@1.0.15

## 1.3.0

### Minor Changes

- [#622](https://github.com/tkhq/sdk/pull/622) [`59f8941`](https://github.com/tkhq/sdk/commit/59f8941f77e548e248b2fdafcad36f5f0c2a5d29) Author [@moeodeh3](https://github.com/moeodeh3) - Added support for React 19

  Renamed `sessionKey` parameter to `storageKey` in `createEmbeddedKey` `saveEmbeddedKey` and `getEmbeddedKey`.

  Added optional `embeddedStorageKey` parameter to `createSession`. This allows for retrieval of the embedded key from a custom location in secure storage.

### Patch Changes

- [#641](https://github.com/tkhq/sdk/pull/641) [`77611c8`](https://github.com/tkhq/sdk/commit/77611c8f15aa16b316d81ee6addab62d86f2f3bc) Author [@amircheikh](https://github.com/amircheikh) - Added `onSessionEmpty`. A callback function that runs when there is no active session on app launch.

- Updated dependencies [[`07dfd33`](https://github.com/tkhq/sdk/commit/07dfd3397472687092e1c73b1d68714f421b9ca0)]:
  - @turnkey/http@3.4.0
  - @turnkey/crypto@2.3.1
  - @turnkey/react-native-passkey-stamper@1.0.14

## 1.2.3

### Patch Changes

- Updated dependencies [25ca339]
  - @turnkey/http@3.3.0
  - @turnkey/crypto@2.3.1
  - @turnkey/react-native-passkey-stamper@1.0.13

## 1.2.2

### Patch Changes

- ef399e1: - Eliminated a race condition in `refreshSession` that could throw:
  `TurnkeyReactNativeError: Embedded key not found when refreshing the session`

  - The embedded key is now generated entirely in memory using `generateP256KeyPair`
  - Removed the need to store and immediately retrieve the private key from secure storage
  - `refreshSession` now accepts a single optional parameter object
  - `StorageKeys.RefreshEmbeddedKey` is now deprecated and no longer used during session refresh

- Updated dependencies [3f6e415]
- Updated dependencies [4d1d775]
  - @turnkey/http@3.2.0
  - @turnkey/api-key-stamper@0.4.5
  - @turnkey/crypto@2.3.1
  - @turnkey/react-native-passkey-stamper@1.0.12

## 1.2.1

### Patch Changes

- Updated dependencies [3e4a482]
  - @turnkey/http@3.1.0
  - @turnkey/crypto@2.3.1
  - @turnkey/react-native-passkey-stamper@1.0.11

## 1.2.0

### Minor Changes

- ab45d29: Added `createSessionFromEmbeddedKey` function. This allows creation of a session using a compressed embedded key stored by calling `createEmbeddedKey`. You may also optionally pass in an embedded key created seperately. Utilizing these two functions with a `createSuborg` api call allows for a '1 tap' passkey sign up flow [(example)](https://github.com/tkhq/react-native-demo-wallet/blob/ccf2d6c182b9e5c5ce98014a56b0b9f4282277c2/providers/auth-provider.tsx#L186).

  Added optional `isCompressed` boolean field to the `createEmbeddedKey` function. This field is necessary for calling `createSessionFromEmbeddedKey`.

## 1.1.0

### Minor Changes

- e8bc05b: Introduces handleGoogleOAuth(): Adds a utility function to handle the Google OAuth authentication flow in React Native.

**Usage Summary**:  
`handleGoogleOAuth` launches an InAppBrowser to initiate the OAuth flow using your client ID, nonce, and app scheme. After a successful login, it extracts the `oidcToken` from the redirect URL and calls your `onSuccess` callback with the token.

```ts
handleGoogleOAuth({
  clientId: string,           // Google OAuth client ID
  nonce: string,              // Random nonce
  scheme: string,             // App’s custom URL scheme (e.g., "myapp")
  originUri?: string,         // Optional custom origin URI - defaults to Turnkey proxies
  redirectUri?: string,       // Optional custom redirect URI - defaults to Turnkey proxies
  onSuccess: (oidcToken: string) => void, // Called with token on success
});
```

## 1.0.5

### Patch Changes

- 3b5b360: - Adds optional parameter for createEmbeddedKey():
  - You can now pass a sessionKey to createEmbeddedKey() to generate separate embedded keys for different sessions, which is helpful when running multiple authentication flows concurrently.
  - Introduces onSessionExpiryWarning():
    - You can now add a callback via the provider config that triggers 15 seconds before a session expires.
  - Introduces refreshSession():
    - You now can refresh an active session that is about to expire.

## 1.0.4

### Patch Changes

- Updated dependencies [d1083bd]
- Updated dependencies [f94d36e]
  - @turnkey/http@3.0.0
  - @turnkey/crypto@2.3.1

## 1.0.3

### Minor Changes

- a7e7de0: Fixed compatibility issue with `@turnkey/viem`

## 1.0.2

### Patch Changes

- Updated dependencies [ecdb29a]
  - @turnkey/http@2.22.0
  - @turnkey/crypto@2.3.1

## 1.0.1

### Patch Changes

- Updated dependencies [56a307e]
  - @turnkey/http@2.21.0
  - @turnkey/crypto@2.3.1

## 1.0.0

### Major Changes

- fcf9503: This breaking change adds support for multiple sessions:

  - The concept of a **selected session** has been introduced:
    - Users can switch between sessions using `setSelectedSession({ sessionKey: <key> })`.
    - The selected session determines the active `client`, `user`, and `session` state.
    - API calls such as `updateUser`, `createWallet`, and `signRawPayload` now apply to the selected session.
  - A session limit of **15 active sessions** has been enforced:
    - If the limit is reached, users must remove an existing session before creating a new one.
    - Expired or invalid sessions are automatically cleaned up.

## 0.1.1

### Patch Changes

- Updated dependencies [3c44c4a]
  - @turnkey/http@2.20.0
  - @turnkey/crypto@2.3.1
