# @turnkey/indexed-db-stamper

## 1.1.1

### Patch Changes

- Updated dependencies [[`7625df0`](https://github.com/tkhq/sdk/commit/7625df0538002c3455bd5862211210e38472e164)]:
  - @turnkey/api-key-stamper@0.4.7

## 1.1.0

### Minor Changes

- [#653](https://github.com/tkhq/sdk/pull/653) [`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a) Thanks [@moe-dev](https://github.com/moe-dev)! - Allow external keys to be passed to resetKeyPair in the indexedDbClient/Stamper enabling refreshing RW sessions

### Patch Changes

- Updated dependencies [[`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a)]:
  - @turnkey/encoding@0.5.0
  - @turnkey/api-key-stamper@0.4.6

## 1.0.0

### Major Changes

- Initial release of @turnkey/indexed-db-stamper: A client-side library for securely managing cryptographic keys within the browser using IndexedDB. It enables seamless, secure authentication by storing unextractable cryptographic key material, allowing for safe signing of Turnkey API requests directly from client-side web applications
