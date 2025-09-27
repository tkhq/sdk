# @turnkey/core

## 1.2.0

### Minor Changes

- [#977](https://github.com/tkhq/sdk/pull/977) [`4567059`](https://github.com/tkhq/sdk/commit/45670598f102223925b87a5295edca15a6ce8241) Author [@besler613](https://github.com/besler613) - OAuth2Authenticate now supports returning the encrypted bearer token via the optional `bearerTokenTargetPublicKey` request parameter (mono release v2025.9.5)

### Patch Changes

- [#972](https://github.com/tkhq/sdk/pull/972) [`010543c`](https://github.com/tkhq/sdk/commit/010543c3b1b56a18816ea92a1a1cbe028cf988e4) Author [@moeodeh3](https://github.com/moeodeh3) - Fix exported types

- Updated dependencies [[`4567059`](https://github.com/tkhq/sdk/commit/45670598f102223925b87a5295edca15a6ce8241)]:
  - @turnkey/sdk-types@0.5.0
  - @turnkey/http@3.13.0
  - @turnkey/crypto@2.7.0
  - @turnkey/react-native-passkey-stamper@1.2.2

## 1.1.0

### Minor Changes

- [#940](https://github.com/tkhq/sdk/pull/940) [`e4bc82f`](https://github.com/tkhq/sdk/commit/e4bc82fc51c692d742923ccfff72c2c862ee71a4) Author [@moeodeh3](https://github.com/moeodeh3) - - Added optional params for sessionless stamping (passkey/wallet only setups)

### Patch Changes

- [#946](https://github.com/tkhq/sdk/pull/946) [`0080c4d`](https://github.com/tkhq/sdk/commit/0080c4d011a7f8d04b41d89b31863b75d1a816ef) Author [@moeodeh3](https://github.com/moeodeh3) - - Added `proposalExpired` event emission in WalletConnect provider
  - Added automatic URI regeneration when a WalletConnect URI expires

- [#958](https://github.com/tkhq/sdk/pull/958) [`5a96fe8`](https://github.com/tkhq/sdk/commit/5a96fe80db4c4c45e09ad8c613695ee4c2b8e51f) Author [@amircheikh](https://github.com/amircheikh) - - Synced api with mono

- [#960](https://github.com/tkhq/sdk/pull/960) [`c2a0bd7`](https://github.com/tkhq/sdk/commit/c2a0bd7ea8a53524cde16897f375f8a7088ba963) Author [@moeodeh3](https://github.com/moeodeh3) - - Removed requirement of session for external wallet usage
  - `connectExternalWalletAccount()` now returns the wallet address instead of `void`
  - `fetchWallets()` now supports an optional `connectedOnly` parameter to fetch only connected wallets

- [#940](https://github.com/tkhq/sdk/pull/940) [`90841f9`](https://github.com/tkhq/sdk/commit/90841f95f3f738c47c04797096902d9d0a23afc7) Author [@moeodeh3](https://github.com/moeodeh3) - - Fixed signMessage() to respect the provided encoding override instead of silently ignoring it
  - Corrected Ethereum message prefixing for embedded wallets in `signMessage()` to fully align with EIP-191 standards
- Updated dependencies [[`2191a1b`](https://github.com/tkhq/sdk/commit/2191a1b201fb17dea4c79cf9e02b3a493b18f97a), [`5a96fe8`](https://github.com/tkhq/sdk/commit/5a96fe80db4c4c45e09ad8c613695ee4c2b8e51f)]:
  - @turnkey/crypto@2.7.0
  - @turnkey/sdk-types@0.4.1
  - @turnkey/http@3.12.1
  - @turnkey/react-native-passkey-stamper@1.2.1

## 1.0.0

### Major Changes

- Initial Stable Release: `@turnkey/core` 🎉  
  Turnkey’s **core TypeScript client-side SDK** for Embedded Wallets is now generally available.
  - Provides a set of functions and utilities to interact with Turnkey’s APIs
  - Includes a powerful session management system
  - Comes with built-in stampers for signing flows
  - Exposes a raw HTTP client for advanced use cases
  - Designed to be the foundation for building Embedded Wallets across frameworks (React, React Native, Angular, Vue, Svelte)

  📚 [Read the full docs here](https://docs.turnkey.com/sdks/typescript-frontend)

### Minor Changes

- [#677](https://github.com/tkhq/sdk/pull/677) [`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e) Author [@amircheikh](https://github.com/amircheikh) - @turnkey/react-wallet-kit and @turnkey/core beta-3 release

- [#677](https://github.com/tkhq/sdk/pull/677) [`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e) Author [@amircheikh](https://github.com/amircheikh) - @turnkey/react-wallet-kit and @turnkey/core beta-3 release

- [#677](https://github.com/tkhq/sdk/pull/677) [`4880f26`](https://github.com/tkhq/sdk/commit/4880f26a4dd324c049bff7f35284098ccfc55823) Author [@amircheikh](https://github.com/amircheikh) - @turnkey/react-wallet-kit and @turnkey/core beta release

- [#677](https://github.com/tkhq/sdk/pull/677) [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c) Author [@amircheikh](https://github.com/amircheikh) - updating package versions

- [#677](https://github.com/tkhq/sdk/pull/677) [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c) Author [@amircheikh](https://github.com/amircheikh) - test build

- [#677](https://github.com/tkhq/sdk/pull/677) [`06347ad`](https://github.com/tkhq/sdk/commit/06347adfa08fb0867c350e43821d0fed06c49624) Author [@amircheikh](https://github.com/amircheikh) - SDK beta release @turnkey/react-wallet-kit @turnkey/core

### Patch Changes

- Updated dependencies [[`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e), [`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e), [`4880f26`](https://github.com/tkhq/sdk/commit/4880f26a4dd324c049bff7f35284098ccfc55823), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`06347ad`](https://github.com/tkhq/sdk/commit/06347adfa08fb0867c350e43821d0fed06c49624), [`6bfcbc5`](https://github.com/tkhq/sdk/commit/6bfcbc5c098e64ab1d115518733b87cfc1653e17)]:
  - @turnkey/sdk-types@0.4.0
  - @turnkey/encoding@0.6.0
  - @turnkey/http@3.12.0
  - @turnkey/crypto@2.6.0
  - @turnkey/react-native-passkey-stamper@1.2.0
  - @turnkey/webauthn-stamper@0.6.0
  - @turnkey/api-key-stamper@0.5.0

## 1.0.0-beta.6

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta release

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.6
  - @turnkey/encoding@0.6.0-beta.6
  - @turnkey/crypto@2.6.0-beta.6
  - @turnkey/api-key-stamper@0.5.0-beta.6
  - @turnkey/http@3.11.1-beta.0
  - @turnkey/react-native-passkey-stamper@1.2.0-beta.1

## 1.0.0-beta.5

### Minor Changes

- SDK beta release @turnkey/react-wallet-kit @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/react-native-passkey-stamper@1.2.0-beta.0
  - @turnkey/webauthn-stamper@0.6.0-beta.0
  - @turnkey/api-key-stamper@0.5.0-beta.5
  - @turnkey/sdk-types@0.4.0-beta.5
  - @turnkey/encoding@0.6.0-beta.5
  - @turnkey/crypto@2.6.0-beta.5
  - @turnkey/http@3.10.0-beta.2

## 1.0.0-beta.4

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta-3 release

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.4
  - @turnkey/encoding@0.6.0-beta.4
  - @turnkey/http@3.10.0-beta.1
  - @turnkey/api-key-stamper@0.4.8-beta.4
  - @turnkey/crypto@2.5.1-beta.4
  - @turnkey/react-native-passkey-stamper@1.1.2-beta.4

## 1.0.0-beta.3

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta-3 release

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.3
  - @turnkey/encoding@0.6.0-beta.3
  - @turnkey/http@3.10.0-beta.0
  - @turnkey/api-key-stamper@0.4.8-beta.3
  - @turnkey/crypto@2.5.1-beta.3
  - @turnkey/react-native-passkey-stamper@1.1.2-beta.3

## 1.0.0-beta.2

### Minor Changes

- updating package versions

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.2
  - @turnkey/encoding@0.6.0-beta.2
  - @turnkey/api-key-stamper@0.4.8-beta.2
  - @turnkey/crypto@2.5.1-beta.2
  - @turnkey/http@3.8.1-beta.2
  - @turnkey/react-native-passkey-stamper@1.1.2-beta.2

## 1.0.0-beta.1

### Minor Changes

- test build

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.1
  - @turnkey/encoding@0.6.0-beta.1
  - @turnkey/api-key-stamper@0.4.8-beta.1
  - @turnkey/crypto@2.5.1-beta.1
  - @turnkey/http@3.8.1-beta.1
  - @turnkey/react-native-passkey-stamper@1.1.2-beta.1

## 1.0.0-beta.0

### Major Changes

- beta for @turnkey/react-wallet-kit and @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.0
  - @turnkey/encoding@0.6.0-beta.0
  - @turnkey/api-key-stamper@0.4.8-beta.0
  - @turnkey/crypto@2.5.1-beta.0
  - @turnkey/http@3.8.1-beta.0
  - @turnkey/react-native-passkey-stamper@1.1.2-beta.0

## 1.0.0

### Major Changes

- Initial beta release for react wallet kit

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0
  - @turnkey/encoding@0.6.0
  - @turnkey/api-key-stamper@0.4.8
  - @turnkey/crypto@2.5.1
  - @turnkey/http@3.8.1
  - @turnkey/react-native-passkey-stamper@1.1.2

## 1.0.0

### Major Changes

- Initial beta release for @turnkey/react-wallet-kit and @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0
  - @turnkey/encoding@0.6.0
  - @turnkey/api-key-stamper@0.4.8
  - @turnkey/crypto@2.5.1
  - @turnkey/http@3.8.1
  - @turnkey/react-native-passkey-stamper@1.1.2
