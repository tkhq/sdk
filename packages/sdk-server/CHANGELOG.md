# @turnkey/sdk-server

## 1.5.0

### Minor Changes

- 9ebd062: Release OTP functionality

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/http@2.15.0

## 1.4.2

### Patch Changes

- abe7138: Export DEFAULT_SOLANA_ACCOUNTS
- 96d7f99: Update dependencies
- Updated dependencies [96d7f99]
  - @turnkey/http@2.14.2
  - @turnkey/api-key-stamper@0.4.3

## 1.4.1

### Patch Changes

- ff059d5: Update dependencies
- Updated dependencies [ff059d5]
  - @turnkey/http@2.14.1
  - @turnkey/api-key-stamper@0.4.2

## 1.4.0

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

- Updated dependencies [2d7e5a9]
  - @turnkey/api-key-stamper@0.4.1
  - @turnkey/http@2.12.2

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

## 0.2.0

### Minor Changes

- updated syntax

### Patch Changes

- e4d2a84: Update client name

## 0.1.0

### Minor Changes

- Ready for 0.1.0

## 0.0.1

Initial (experimental) release! This is an alpha release and subject to change.
