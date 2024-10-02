# @turnkey/crypto

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
