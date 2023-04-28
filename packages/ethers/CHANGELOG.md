# @turnkey/ethers

## 0.10.0

### Minor Changes

- Added EIP-712 support for signing typed data to Ethers.
- Update Gnosis example to make use of new signing functionality.

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.10.0

## 0.9.0

### Minor Changes

- Improved support for React Native runtime (https://github.com/tkhq/sdk/pull/37)

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.9.0

## 0.8.1

### Patch Changes

- Switched from `undici` to `cross-fetch` to improve bundler compatibility
- Updated dependencies
  - @turnkey/http@0.8.1

## 0.8.0

### Minor Changes

- Added browser runtime support — `@turnkey/ethers` is now a universal (isomorphic) package
- Dropped support for Node.js v14; we recommend using Node v18+

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.8.0

## 0.7.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.7.0

## 0.6.0

### Minor Changes

- `#signMessage(...)`: move encoding and hashing logic to client side, `eth_sign` style

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.6.0

## 0.5.0

### Minor Changes

- Arbitrary message signing

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.5.0

## 0.4.0

### Minor Changes

- `timestamp` -> `timestampMs`

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.4.0

## 0.3.1

### Patch Changes

- Fix outdated artifact
- Updated dependencies
  - @turnkey/http@0.3.1

## 0.3.0

### Minor Changes

- `keyId` -> `privateKeyId` everywhere

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.3.0

## 0.2.0

### Minor Changes

- Change parameter from `keyId` to `privateKeyId`
- Bump API version to latest Beta

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.2.0

## 0.1.3

### Patch Changes

- Support runtime config for credentials
- Updated dependencies
  - @turnkey/http@0.1.3

## 0.1.2

### Patch Changes

- Drop internal dev dependency
- Updated dependencies
  - @turnkey/http@0.1.2

## 0.1.1

### Patch Changes

- Initial release
- Updated dependencies
  - @turnkey/http@0.1.1
