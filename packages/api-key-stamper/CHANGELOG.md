# @turnkey/api-key-stamper

## 0.5.0

### Minor Changes

- Updated dependencies [[`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e), [`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e), [`4880f26`](https://github.com/tkhq/sdk/commit/4880f26a4dd324c049bff7f35284098ccfc55823), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`06347ad`](https://github.com/tkhq/sdk/commit/06347adfa08fb0867c350e43821d0fed06c49624), [`6bfcbc5`](https://github.com/tkhq/sdk/commit/6bfcbc5c098e64ab1d115518733b87cfc1653e17)]:
  - @turnkey/encoding@0.6.0

## 0.5.0-beta.6

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.6

## 0.5.0-beta.5

### Minor Changes

- SDK beta release @turnkey/react-wallet-kit @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.5

## 0.4.8-beta.4

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.4

## 0.4.8-beta.3

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.3

## 0.4.8-beta.2

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.2

## 0.4.8-beta.1

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.1

## 0.4.8-beta.0

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.0

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
