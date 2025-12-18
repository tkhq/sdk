# @turnkey/crypto

## 2.8.8

### Patch Changes

- Updated dependencies [[`78ec1d9`](https://github.com/tkhq/sdk/commit/78ec1d9afcafde3ca7107fc720323d486d6afaea)]:
  - @turnkey/sdk-types@0.11.0

## 2.8.7

### Patch Changes

- Updated dependencies [[`29a42db`](https://github.com/tkhq/sdk/commit/29a42db8f5f3ef8b9c23c90cd00f4c21027aac2e)]:
  - @turnkey/sdk-types@0.10.0

## 2.8.6

### Patch Changes

- Updated dependencies [[`80ea306`](https://github.com/tkhq/sdk/commit/80ea306025a2161ff575a5e2b45794460eafdf1b)]:
  - @turnkey/sdk-types@0.9.0

## 2.8.5

### Patch Changes

- [#1068](https://github.com/tkhq/sdk/pull/1068) [`5f829c6`](https://github.com/tkhq/sdk/commit/5f829c67af03bb85c3806acd202b2debf8274e78) Author [@moeodeh3](https://github.com/moeodeh3) - - Updated dependencies [[`9fbd5c4`](https://github.com/tkhq/sdk/commit/9fbd5c459782dc3721dd0935d0a4458babce258b):
  - @turnkey/sdk-types@0.7.0
- Updated dependencies [[`084acce`](https://github.com/tkhq/sdk/commit/084acce85fe7c15513a025e77c1571012ac82e4b), [`67b03a5`](https://github.com/tkhq/sdk/commit/67b03a5d9ab1b6eabfb0b41938ac91365b5dcd9b)]:
  - @turnkey/sdk-types@0.8.0

## 2.8.4

### Patch Changes

- [#1050](https://github.com/tkhq/sdk/pull/1050) [`c745646`](https://github.com/tkhq/sdk/commit/c745646ae4b2a275e116abca07c6e108f89beb04) Author [@amircheikh](https://github.com/amircheikh) - - Removed `@peculiar/webcrypto` dependancy. This will fix build errors in environments where `webcrypto` is not defined but will still require a polyfill if you use a function where `webcrypto` is required.

## 2.8.3

### Patch Changes

- [#992](https://github.com/tkhq/sdk/pull/992) [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186) Author [@amircheikh](https://github.com/amircheikh) - - `verify` function is now exposed and supports web platforms

- Updated dependencies [[`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186)]:
  - @turnkey/sdk-types@0.6.3

## 2.8.2

### Patch Changes

- Updated dependencies [[`9df42ad`](https://github.com/tkhq/sdk/commit/9df42adc02c7ff77afba3b938536e79b57882ef1)]:
  - @turnkey/sdk-types@0.6.2

## 2.8.1

### Patch Changes

- Updated dependencies [[`68631c4`](https://github.com/tkhq/sdk/commit/68631c4008387f845dfe4f1a139981011727f6c9)]:
  - @turnkey/sdk-types@0.6.1

## 2.8.0

### Minor Changes

- [#974](https://github.com/tkhq/sdk/pull/974) [`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c) Author [@narimonf](https://github.com/narimonf) - Added verification tooling for app proofs and boot proofs. Primarily adds `verify()`, which verifies an app proof boot proof pair.

### Patch Changes

- Updated dependencies [[`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c)]:
  - @turnkey/sdk-types@0.6.0

## 2.7.0

### Minor Changes

- [#947](https://github.com/tkhq/sdk/pull/947) [`2191a1b`](https://github.com/tkhq/sdk/commit/2191a1b201fb17dea4c79cf9e02b3a493b18f97a) Author [@amircheikh](https://github.com/amircheikh) - - Added `encryptOnRampSecret` helper function. This is used for encrypting your fiat on ramp secrets before passing into the `CreateFiatOnRampCredential` activity

## 2.6.0

### Minor Changes

- Updated dependencies [[`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e), [`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e), [`4880f26`](https://github.com/tkhq/sdk/commit/4880f26a4dd324c049bff7f35284098ccfc55823), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`06347ad`](https://github.com/tkhq/sdk/commit/06347adfa08fb0867c350e43821d0fed06c49624), [`6bfcbc5`](https://github.com/tkhq/sdk/commit/6bfcbc5c098e64ab1d115518733b87cfc1653e17)]:
  - @turnkey/encoding@0.6.0

## 2.6.0-beta.6

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta release

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.6

## 2.6.0-beta.5

### Minor Changes

- SDK beta release @turnkey/react-wallet-kit @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.5

## 2.6.0

### Minor Changes

- [#840](https://github.com/tkhq/sdk/pull/840) [`d7420e6`](https://github.com/tkhq/sdk/commit/d7420e6c3559efc1024b58749b31d253150cb189) Author [@zkharit](https://github.com/zkharit) - This change adds a new encryption mechanism to allow for messages to be encrypted to an enclaves quorum public key. A helper function specifically for OAith 2.0 client secret encryption is also included

## 2.5.1-beta.4

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.4

## 2.5.1-beta.3

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.3

## 2.5.1-beta.2

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.2

## 2.5.1-beta.1

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.1

## 2.5.1-beta.0

### Patch Changes

- Updated dependencies []:
  - @turnkey/encoding@0.6.0-beta.0

## 2.5.0

### Minor Changes

- [#812](https://github.com/tkhq/sdk/pull/812) [`6cde41c`](https://github.com/tkhq/sdk/commit/6cde41cfecdfb7d54abf52cc65e28ef0e2ad6ba3) Author [@turnekybc](https://github.com/turnekybc) - Add `@turnkey/encoding` as a package dependency instead of a devDependency to `@turnkey/crypto`. This resolves an issue with transitive dependencies when devDependencies are not included in the artifact.

## 2.4.3

### Patch Changes

- [#720](https://github.com/tkhq/sdk/pull/720) [`6cbff7a`](https://github.com/tkhq/sdk/commit/6cbff7a0c0b3a9a05586399e5cef476154d3bdca) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `decryptExportBundle` not working in some environments by adding a shim to handle `bs58`'s ESM-only export.

## 2.4.2

### Patch Changes

- [#699](https://github.com/tkhq/sdk/pull/699) [`c5cdf82`](https://github.com/tkhq/sdk/commit/c5cdf8229da5da1bd6d52db06b2fe42826e96d57) Author [@andrewkmin](https://github.com/andrewkmin) - Add validations to `fromDerSignature` for parsing DER signatures in the Turnkey context

- [#716](https://github.com/tkhq/sdk/pull/716) [`fa46701`](https://github.com/tkhq/sdk/commit/fa467019eef34b5199372248edff1e7a64934e79) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `decryptCredentialBundle` not working in React Native by adding a shim to handle `bs58check`'s ESM-only export.

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
