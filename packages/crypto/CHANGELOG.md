# @turnkey/crypto

## 2.4.1

### Patch Changes

- [#700](https://github.com/tkhq/sdk/pull/700) [`878e039`](https://github.com/tkhq/sdk/commit/878e03973856cfec83e6e3fda5b76d1b64943628) Author [@andrewkmin](https://github.com/andrewkmin) - Add validations to uncompressRawPublicKey method

## 2.4.0

### Minor Changes

- [#662](https://github.com/tkhq/sdk/pull/662) [`10ee5c5`](https://github.com/tkhq/sdk/commit/10ee5c524b477ce998e4fc635152cd101ae5a9cc) Thanks [@moe-dev](https://github.com/moe-dev)! - Add function `verifySessionJwtSignature` to verify session tokens return from Turnkey and signed by the notarizer

## 2.3.1

### Patch Changes

- 2bc0046: Migrated from WebCrypto (crypto.subtle.verify) to Noble for ECDSA signature verification

## 2.3.0

### Minor Changes

- 668edfa: Add keyformat to decryptExportBundle for displaying Solana private keys

## 2.2.0

### Minor Changes

- Added `toDerSignature` function used to convert a raw ECDSA signature into DER-encoded format for compatibility with our backend, which requires DER signatures

## 2.1.0

### Minor Changes

- https://github.com/tkhq/sdk/pull/384: Reorganize into two subparts:

  - `crypto.ts`: core cryptography utilities
  - `turnkey.ts`: Turnkey-specific cryptography utilities

  Add `verifyStampSignature` method:

  - See in-line code docs for more details + example of usage
  - This is useful for checking the validity of a stamp (signature) against the request body

### Patch Changes

- d989d46: Remove unnecessary react/typsecript packages

## 2.0.0

### Major Changes

- [BREAKING CHANGE] renamed `decryptBundle` to `decryptCredentialBundle` (for decrypting email auth/recovery and oauth credential bundles) in order to distinguish from the new `decryptExportBundle` (for decrypting bundles containing wallet mnemonics or private key material)

### Patch Changes

- Updated dependencies [e5c4fe9]
  - @turnkey/encoding@0.4.0

## 1.0.0

### Major Changes

- 93666ff: turnkey/crypto standard HPKE encryption, first major release. Allows for programmatic importing in environments like node. Moved some encoding helper functions to turnkey/encoding

### Patch Changes

- Updated dependencies [93666ff]
  - @turnkey/encoding@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @turnkey/encoding@0.2.1

## 0.2.0

### Minor Changes

- Add HPKE encryption

## 0.1.1

### Patch Changes

- d968e0b: Bugfix: return public key

## 0.1.0

Initial release
