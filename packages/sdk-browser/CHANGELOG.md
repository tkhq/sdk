# @turnkey/sdk-browser

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
