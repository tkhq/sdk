# @turnkey/sdk-react-native

## 1.4.1

### Patch Changes

- Updated dependencies [[`f83f25b`](https://github.com/tkhq/sdk/commit/f83f25ba33ef15dbd66723531eebe2fd00f43ac0)]:
  - @turnkey/http@3.8.0
  - @turnkey/crypto@2.5.0
  - @turnkey/react-native-passkey-stamper@1.1.1

## 1.4.0

### Minor Changes

- [#651](https://github.com/tkhq/sdk/pull/651) [`81e355c`](https://github.com/tkhq/sdk/commit/81e355c9a8321feffcac056916b65139cf35eeed) Author [@turnekybc](https://github.com/turnekybc) - Add Coinbase & MoonPay Fiat Onramp. View the [Fiat Onramp feature docs](https://docs.turnkey.com/wallets/fiat-on-ramp).

### Patch Changes

- Updated dependencies [[`81e355c`](https://github.com/tkhq/sdk/commit/81e355c9a8321feffcac056916b65139cf35eeed), [`6cde41c`](https://github.com/tkhq/sdk/commit/6cde41cfecdfb7d54abf52cc65e28ef0e2ad6ba3)]:
  - @turnkey/react-native-passkey-stamper@1.1.0
  - @turnkey/http@3.7.0
  - @turnkey/crypto@2.5.0

## 1.3.7

### Patch Changes

- Updated dependencies [[`e90a478`](https://github.com/tkhq/sdk/commit/e90a478c9208d858b1144df9b2c2c7ba956c406e)]:
  - @turnkey/http@3.6.0
  - @turnkey/crypto@2.4.3
  - @turnkey/react-native-passkey-stamper@1.0.19

## 1.3.6

### Patch Changes

- Updated dependencies [[`cb13c26`](https://github.com/tkhq/sdk/commit/cb13c26edb79a01ab651e3b2897334fd154b436a)]:
  - @turnkey/http@3.5.1
  - @turnkey/crypto@2.4.3
  - @turnkey/react-native-passkey-stamper@1.0.18

## 1.3.5

### Patch Changes

- Updated dependencies [[`6cbff7a`](https://github.com/tkhq/sdk/commit/6cbff7a0c0b3a9a05586399e5cef476154d3bdca)]:
  - @turnkey/crypto@2.4.3

## 1.3.4

### Patch Changes

- [#711](https://github.com/tkhq/sdk/pull/711) [`22dc1aa`](https://github.com/tkhq/sdk/commit/22dc1aa3f289ddc5818fb7328235eaa873f8f367) Author [@moeodeh3](https://github.com/moeodeh3) - Added `onInitialized`. A callback function that runs when context initialization is complete, useful for notifying connected apps.

- Updated dependencies [[`c5cdf82`](https://github.com/tkhq/sdk/commit/c5cdf8229da5da1bd6d52db06b2fe42826e96d57), [`fa46701`](https://github.com/tkhq/sdk/commit/fa467019eef34b5199372248edff1e7a64934e79)]:
  - @turnkey/crypto@2.4.2

## 1.3.3

### Patch Changes

- Updated dependencies [[`5f3dd98`](https://github.com/tkhq/sdk/commit/5f3dd9814650308b3bf3198168c453e7b1a98efd), [`7625df0`](https://github.com/tkhq/sdk/commit/7625df0538002c3455bd5862211210e38472e164), [`878e039`](https://github.com/tkhq/sdk/commit/878e03973856cfec83e6e3fda5b76d1b64943628)]:
  - @turnkey/http@3.5.0
  - @turnkey/api-key-stamper@0.4.7
  - @turnkey/crypto@2.4.1
  - @turnkey/react-native-passkey-stamper@1.0.17

## 1.3.2

### Patch Changes

- Updated dependencies [[`be0a621`](https://github.com/tkhq/sdk/commit/be0a621fb962bd51d2df1a1e79f5260d7c696772)]:
  - @turnkey/http@3.4.2
  - @turnkey/crypto@2.4.0
  - @turnkey/react-native-passkey-stamper@1.0.16

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
