# @turnkey/webauthn-stamper

## 0.6.0

## 0.6.0-beta.0

### Minor Changes

- SDK beta release @turnkey/react-wallet-kit @turnkey/core

## 0.5.1

### Patch Changes

- [#659](https://github.com/tkhq/sdk/pull/659) [`5afbe51`](https://github.com/tkhq/sdk/commit/5afbe51949bdd1997fad083a4c1e4272ff7409dc) Author [@turnekybc](https://github.com/turnekybc) - export types and models from @turnkey/sdk-browser

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
