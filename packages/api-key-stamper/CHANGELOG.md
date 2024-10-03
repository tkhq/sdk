# @turnkey/api-key-stamper

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
