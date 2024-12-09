# @turnkey/sdk-browser

## 1.10.2

### Patch Changes

- Updated dependencies [668edfa]
  - @turnkey/crypto@2.3.0
  - @turnkey/wallet-stamper@1.0.1

## 1.10.1

### Patch Changes

- Updated dependencies [78bc39c]
  - @turnkey/http@2.17.0
  - @turnkey/crypto@2.2.0
  - @turnkey/wallet-stamper@1.0.0

## 1.10.0

### Minor Changes

##### `TurnkeyWalletClient`

- Added new `TurnkeyWalletClient` to the `@turnkey/sdk-browser`
  **Reason**: Allows using the `WalletStamper` with the browser sdk
- Added `getPublicKey` method to `TurnkeyWalletClient`
  **Reason**: Enables easy access to wallet public key for sub-organization creation and future authentication flows
- Updated `TurnkeyWalletClient` to use new `WalletInterface`
  **Reason**: Ensures compatibility with the updated Wallet Stamper interfaces

##### `AuthClient` (new enum)

- Introduced a new enum to track which client is authenticated (Passkey, Wallet, Iframe)

##### `TurnkeyBrowserClient`, `TurnkeyIframeClient`, `TurnkeyPasskeyClient`, `TurnkeyWalletClient`

- Added a static `authClient` property to base `TurnkeyBrowserClient` to be used by the child classes to track which client was used for the initial authentication

##### `UserSession` interface

- Added a new `UserSession` interface which is to be stored in local storage to track the authentication state of the user and to eliminate the need to store the write and read sessions separately.
- Added `authClient` in the session object to store the authentication method used in the user's session data. Will be used in the `@turnkey/sdk-react` to determine which client to return.
- Added new versioned `UserSession` key: `"@turnkey/session/v1"`

##### `login` and `loginWithReadWriteSession` methods

- Updated to use the new `authClient` property to track and store the authentication method used during login

### Patch Changes

- Updated dependencies [8bea78f]
  - @turnkey/wallet-stamper@2.0.0
  - @turnkey/crypto@2.2.0

## 1.9.0

### Minor Changes

- 3dd74ac: Added functionality for constructing and returning stamped requests for all packages
- 1e36edf: Support RS256 by default when invoking createUserPasskey
- 4df8914: Version bump corresponding to mono release v2024.10.10. More detailed changelog to follow
- 11a9e2f: Allow override of WebauthnStamper configuration

### Patch Changes

- Updated dependencies [33e8e03]
- Updated dependencies [d989d46]
- Updated dependencies [4df8914]
  - @turnkey/crypto@2.1.0
  - @turnkey/http@2.16.0

## 1.8.0

### Minor Changes

- 9ebd062: Release OTP functionality

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/http@2.15.0

## 1.7.1

### Patch Changes

- 96d7f99: Update dependencies
- Updated dependencies [e5c4fe9]
- Updated dependencies [96d7f99]
  - @turnkey/crypto@2.0.0
  - @turnkey/encoding@0.4.0
  - @turnkey/http@2.14.2
  - @turnkey/api-key-stamper@0.4.3

## 1.7.0

### Minor Changes

- ff059d5: Add ability to create a read + write session

### Patch Changes

- Updated dependencies [ff059d5]
- Updated dependencies [93666ff]
  - @turnkey/http@2.14.1
  - @turnkey/crypto@1.0.0
  - @turnkey/encoding@0.3.0
  - @turnkey/api-key-stamper@0.4.2

## 1.6.0

### Minor Changes

- c988ed0: Support activity polling (e.g. for awaiting consensus)

  - [Breaking] Update the `activityPoller` parameter for configuring polling behavior
  - Polling continues until either a max number of retries is reached, or if the activity hits a terminal status

  The shape of the parameter has gone from:

  ```
  {
    duration: number;
    timeout: number;
  }
  ```

  to

  ```
  {
    intervalMs: number;
    numRetries: number;
  }
  ```

### Patch Changes

- Updated dependencies [848f8d3]
  - @turnkey/http@2.14.0

## 1.5.0

### Minor Changes

- 1813ed5: Allow `organizationId` override for `TurnkeyBrowserClient.login` with an extra `config` argument

## 1.4.0

### Minor Changes

- bab5393: Add keyformat to key export bundle injection

### Patch Changes

- a16073c: Exposes storage APIs used by the sdk for managing users & sessions
- 7e7d209: Add authenticatorAttachment option

## 1.3.0

### Minor Changes

- 93dee46: Add create read write session v2 which allows for user targeting directly from stamp or optional userId in intent

### Patch Changes

- Updated dependencies [93dee46]
  - @turnkey/http@2.13.0

## 1.2.4

### Patch Changes

- Updated dependencies [e2f2e0b]
  - @turnkey/http@2.12.3

## 1.2.3

### Patch Changes

- Fix activity versioning for CREATE_SUB_ORGANIZATION (V5=>V6)

## 1.2.2

### Patch Changes

- f4b607f: Verify and pad uncompressed public keys while creating passkey sessions

- Updated dependencies
  - @turnkey/api-key-stamper@0.4.1
  - @turnkey/encoding@0.2.1
  - @turnkey/http@2.12.2
  - @turnkey/crypto@0.2.1

## 1.2.1

### Patch Changes

- f17a229: Update to oauth related endpoints to drop jwks uri from oauth providers
- Updated dependencies [f17a229]
  - @turnkey/http@2.12.1

## 1.2.0

### Minor Changes

- Add Email Auth V2 - Optional invalidate exisiting Email Authentication API keys

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.0

## 1.1.0

### Minor Changes

- Update to use new endpoints. Including CREATE_READ_WRITE_SESSION which allows one shot passkey sessions (returns org information and a credential bundle) and CREATE_API_KEYS_V2 which allows a curve type to be passed (SECP256K1 or P256)

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.11.0

## 1.0.0

### Major Changes

- Stable Release: Add Oauth integration. New suborg creation version will now require an oauthProviders field under root users.

## 0.4.1

### Patch Changes

- Updated dependencies
  - @turnkey/crypto@0.2.0

## 0.4.0

### Minor Changes

- e4b29da: Deprecate the `getAuthBundle()` path for passkey sessions and replace it with `getReadWriteSession()` to store authBundles with their expirationTimestamps so applications can better manually manage active writing sessions

## 0.3.0

### Minor Changes

- d409d81: Add support for Passkey Sessions

## 0.2.1

### Patch Changes

- Updated dependencies [5d0bfde]
- Updated dependencies [2f2d09a]
- Updated dependencies [976663e]
  - @turnkey/iframe-stamper@2.0.0

## 0.2.0

### Minor Changes

- updated syntax

### Patch Changes

- Updated dependencies [5d0bfde]
- Updated dependencies [2f2d09a]
- Updated dependencies [976663e]
  - @turnkey/iframe-stamper@2.0.0

## 0.1.0

### Minor Changes

- Ready for 0.1.0

## 0.0.1

Initial (experimental) release! This is an alpha release and subject to change.
