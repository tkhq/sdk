# @turnkey/http

## 0.8.1

### Patch Changes

- Switched from `undici` to `cross-fetch` to improve bundler compatibility

## 0.8.0

### Minor Changes

- Added browser runtime support — `@turnkey/http` is now a universal (isomorphic) package
- The API fetchers are now exported as namespace `TurnkeyApi`. `PublicApiService` has been marked as deprecated, but will remain functional until we hit v1.0.
- Dropped support for Node.js v14; we recommend using Node v18+

## 0.7.0

### Minor Changes

- Improved documentation
- Added `withAsyncPolling(...)` helper to provide built-in async polling support. Read more:
  - https://github.com/tkhq/sdk/tree/main/packages/http#withasyncpolling-helper

## 0.6.0

### Minor Changes

- Improved OpenAPI documentation

## 0.5.0

### Minor Changes

- Arbitrary message signing

## 0.4.0

### Minor Changes

- `timestamp` -> `timestampMs`

## 0.3.1

### Patch Changes

- Fix outdated artifact

## 0.3.0

### Minor Changes

- `keyId` -> `privateKeyId` everywhere

## 0.2.0

### Minor Changes

- Change parameter from `keyId` to `privateKeyId`
- Bump API version to latest Beta

## 0.1.3

### Patch Changes

- Support runtime config for credentials

## 0.1.2

### Patch Changes

- Drop internal dev dependency

## 0.1.1

### Patch Changes

- Initial release
- Updated dependencies
  - @turnkey/jest-config@0.1.1
