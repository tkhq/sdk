# @turnkey/sdk-react

## 1.1.0

### Minor Changes

- The `useTurnkey` hook now returns the new `walletClient`, used for authenticating requests via wallet signatures
- Added new `client` object returned from the `useTurnkey` hook. This is the authenticated client. It will be null if the user is not authenticated. Example:

  ```typescript
  const { client } = useTurnkey();
  ```

### Patch Changes

- Updated dependencies [8bea78f]
  - @turnkey/wallet-stamper@2.0.0
  - @turnkey/sdk-browser@1.10.0

## 1.0.14

### Patch Changes

- Updated dependencies [3dd74ac]
- Updated dependencies [1e36edf]
- Updated dependencies [4df8914]
- Updated dependencies [11a9e2f]
  - @turnkey/sdk-browser@1.9.0

## 1.0.13

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/sdk-browser@1.8.0

## 1.0.12

### Patch Changes

- Updated dependencies [96d7f99]
  - @turnkey/sdk-browser@1.7.1

## 1.0.11

### Patch Changes

- Updated dependencies [ff059d5]
  - @turnkey/sdk-browser@1.7.0

## 1.0.10

### Patch Changes

- Updated dependencies [c988ed0]
  - @turnkey/sdk-browser@1.6.0

## 1.0.9

### Patch Changes

- Updated dependencies [1813ed5]
  - @turnkey/sdk-browser@1.5.0

## 1.0.8

### Patch Changes

- Updated dependencies [bab5393]
- Updated dependencies [a16073c]
- Updated dependencies [7e7d209]
  - @turnkey/sdk-browser@1.4.0

## 1.0.7

### Patch Changes

- Updated dependencies [93dee46]
  - @turnkey/sdk-browser@1.3.0

## 1.0.6

### Patch Changes

- Updated dependencies [e2f2e0b]
  - @turnkey/sdk-browser@1.2.4

## 1.0.5

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@1.2.3

## 1.0.4

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@1.2.2

## 1.0.3

### Patch Changes

- f17a229: Update to oauth related endpoints to drop jwks uri from oauth providers
- Updated dependencies [f17a229]
  - @turnkey/sdk-browser@1.2.1

## 1.0.2

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@1.2.0

## 1.0.1

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@1.1.0

## 1.0.0

### Major Changes

- Stable Release: Add Oauth integration. New suborg creation version will now require an oauthProviders field under root users.

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@1.0.0

## 0.4.1

### Patch Changes

- @turnkey/sdk-browser@0.4.1

## 0.4.0

### Minor Changes

- e4b29da: Deprecate the `getAuthBundle()` path for passkey sessions and replace it with `getReadWriteSession()` to store authBundles with their expirationTimestamps so applications can better manually manage active writing sessions

### Patch Changes

- Updated dependencies [e4b29da]
  - @turnkey/sdk-browser@0.4.0

## 0.3.0

### Minor Changes

- d409d81: Add support for Passkey Sessions

### Patch Changes

- Updated dependencies [d409d81]
  - @turnkey/sdk-browser@0.3.0

## 0.2.1

### Patch Changes

- @turnkey/sdk-browser@0.2.1

## 0.2.0

### Minor Changes

- updated syntax

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@0.2.0

## 0.1.0

### Minor Changes

- Ready for 0.1.0

### Patch Changes

- Updated dependencies
  - @turnkey/sdk-browser@0.1.0

## 0.0.1

Initial (experimental) release! This is an alpha release and subject to change.
