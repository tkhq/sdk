# @turnkey/ethers

## 0.16.2

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.18.0

## 0.16.1

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.17.1

## 0.16.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies [9317f51]
  - @turnkey/http@0.17.0

## 0.15.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.16.0
    - Fix `.postGetPrivateKey(...)`'s underlying path, while adding `@deprecated` `.postGetPrivateKeyBackwardsCompat(...)` for backward compatibility

## 0.14.1

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.15.0

## 0.14.0

### Minor Changes

- `signTransaction(...)` now verifies and drops `tx.from` if present
  - This mimics the behavior of ethers' Wallet [implementation](https://github.com/ethers-io/ethers.js/blob/f97b92bbb1bde22fcc44100af78d7f31602863ab/packages/wallet/src.ts/index.ts#L117-L121)

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.14.0

## 0.13.2

### Patch Changes

- New `TurnkeyRequestError` error class that contains rich error details
- Updated dependencies
  - @turnkey/http@0.13.2

## 0.13.1

### Patch Changes

- Error messages now contain Turnkey-specific error details
- Updated dependencies
  - @turnkey/http@0.13.1

## 0.13.0

### Minor Changes

- No public facing changes

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.13.0

## 0.12.0

### Minor Changes

- Error messages now contain Turnkey-specific error code and message

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.12.0

## 0.11.0

### Minor Changes

- `TurnkeySigner` now conforms to ethers' `TypedDataSigner` interface

### Patch Changes

- Updated dependencies
  - @turnkey/http@0.11.0

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
