# @turnkey/webauthn-stamper

## 0.5.0

### Minor Changes

- Remove dependency on `noble/hashes` and `Buffer` in favor of a minimal sha256 lib
- Introduce `@turnkey/encoding` to consolidate utility functions

## 0.4.3

### Patch Changes

- Upgrade to Node v18 (#184)

## 0.4.2

### Patch Changes

- Make sha256 computation synchronous to resolve ios passkey prompt issues (#179)

## 0.4.1

### Patch Changes

- Fix universal files to stop using `require`. Use ES6 imports instead (#178)

## 0.4.0

### Minor Changes

- Use rollup to build ESM and CommonJS, fix ESM support (#174)

## 0.3.0

### Minor Changes

- Add support for ESM (#154)

## 0.2.0

### Minor Changes

- Adds Buffer polyfill for environments where it is not globally available (https://github.com/tkhq/sdk/pull/125)

## 0.1.0

Initial release
