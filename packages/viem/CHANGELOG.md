# @turnkey/viem

## 0.2.6

### Patch Changes

- 59dcd2f: Unpin typescript
- da7c960: Bump Viem dependency to fix `getAddresses()` for LocalAccount
- Updated dependencies
  - @turnkey/http@1.4.0

## 0.2.5

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.3.0

## 0.2.4

### Patch Changes

- 0ec2d94: Addresses a bug when signing raw messages (see https://github.com/tkhq/sdk/issues/116)

## 0.2.3

### Patch Changes

- Updated dependencies
  - @turnkey/http@1.2.0

## 0.2.2

### Patch Changes

- Updated dependencies
  - @turnkey/api-key-stamper@0.1.1
  - @turnkey/http@1.1.1

## 0.2.1

### Patch Changes

- Fix code sample in the README; add more details and links

## 0.2.0

### Minor Changes

- Add new `createAccount` method and deprecates the existing `createApiAccount`. `createAccount` offers a superset of functionality and works with stampers (`@turnkey/api-key-stamper` / `@turnkey/webauthn-stamper`) to integrate with API keys or passkeys.

### Patch Changes

- Updated dependencies: @turnkey/http@1.1.0
- New dependency: @turnkey/api-key-stamper@0.1.0

## 0.1.1

### Patch Changes

- README updates

## 0.1.0

Initial release!
