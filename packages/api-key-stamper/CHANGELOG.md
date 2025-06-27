# @turnkey/api-key-stamper

## 0.4.7

### Patch Changes

- [#698](https://github.com/tkhq/sdk/pull/698) [`7625df0`](https://github.com/tkhq/sdk/commit/7625df0538002c3455bd5862211210e38472e164) Author [@moeodeh3](https://github.com/moeodeh3) - Introduces an optional `runtimeOverride` parameter that allows the ability to explicitly specify the crypto environment: `"browser"`, `"node"`, or `"purejs"`.

## 0.4.6

### Patch Changes

- Updated dependencies [[`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a)]:
  - @turnkey/encoding@0.5.0

## 0.4.5

### Patch Changes

- 4d1d775: Better error message and docstring for API key import

## 0.4.4

### Patch Changes

- 2d5977b: Update error messaging around api key and target public key usage

## 0.4.3

### Patch Changes

- Updated dependencies [e5c4fe9]
  - @turnkey/encoding@0.4.0

## 0.4.2

### Patch Changes

- Updated dependencies [93666ff]
  - @turnkey/encoding@0.3.0

## 0.4.1

### Patch Changes

- Changes: Resolves bugs where byte arrays might not be sufficiently padded (32 bytes are expected for x, y, and d elements of a JWK)

- Updated dependencies
  - @turnkey/encoding@0.2.1

## 0.4.0

### Minor Changes

- New PureJS implementation for `@turnkey/api-key-stamper`` to support React Native
- Introduce a dependency on `@turnkey/encoding` to consolidate utility functions

## 0.3.1

### Patch Changes

- Upgrade to Node v18 (#184)

## 0.3.0

### Minor Changes

- Use rollup to build ESM and CommonJS, fix ESM support (#174)

## 0.2.0

### Minor Changes

- Add ESM support (#154)

## 0.1.1

### Patch Changes

- Hint for web bundlers not to polyfill Node crypto

## 0.1.0

Initial release
