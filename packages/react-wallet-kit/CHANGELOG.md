# @turnkey/react-wallet-kit

## 1.3.2

### Patch Changes

- [#1010](https://github.com/tkhq/sdk/pull/1010) [`e5b9c5c`](https://github.com/tkhq/sdk/commit/e5b9c5c5694b1f4d60c0b8606822bcd6d61da4a3) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed stuck connecting state in `handleConnectExternalWallet()`

- Updated dependencies [[`e5b9c5c`](https://github.com/tkhq/sdk/commit/e5b9c5c5694b1f4d60c0b8606822bcd6d61da4a3)]:
  - @turnkey/core@1.4.1

## 1.3.1

### Patch Changes

- [#997](https://github.com/tkhq/sdk/pull/997) [`b6f9675`](https://github.com/tkhq/sdk/commit/b6f96757356c8b35563e4147d73a99a95e522a64) Author [@moeodeh3](https://github.com/moeodeh3) - Added missing `publicKey` field to the `onOauthSuccess` callback in OAuth handler functions

## 1.3.0

### Minor Changes

- [#986](https://github.com/tkhq/sdk/pull/986) [`6ceb06e`](https://github.com/tkhq/sdk/commit/6ceb06ebdbb11b017ed97e81a7e0dcb862813bfa) Author [@amircheikh](https://github.com/amircheikh) - - Added `defaultStamperType` param to the configuration. This will force the underlying `httpClient` to default to a specific stamper for all requests
  - Added `createHttpClient` function. This allows a duplicate instance of `TurnkeySDKClientBase` to be created and returned. Custom configuration can be passed in to create an entirely new client with a unique config. This is useful for creating different HTTP clients with different default stampers to be used in our helper packages (`@turnkey/viem`, `@turnkey/ethers`, etc)

- [#993](https://github.com/tkhq/sdk/pull/993) [`68631c4`](https://github.com/tkhq/sdk/commit/68631c4008387f845dfe4f1a139981011727f6c9) Author [@moeodeh3](https://github.com/moeodeh3) - - Added `sendSignedRequest()` to execute any `TSignedRequest` returned by SDK stamping methods.
  - Added `buildWalletLoginRequest()` method, which prepares and signs a wallet login request without sending it to Turnkey, returning the `stampLogin` signed request alongside the wallet’s public key used for login.

### Patch Changes

- [#989](https://github.com/tkhq/sdk/pull/989) [`9ca7b8b`](https://github.com/tkhq/sdk/commit/9ca7b8bdf7cb897948d377d544b85b69a98b7a29) Author [@amircheikh](https://github.com/amircheikh) - Padding and margin styles are now only forced under `.tk-modal`

- Updated dependencies [[`68631c4`](https://github.com/tkhq/sdk/commit/68631c4008387f845dfe4f1a139981011727f6c9), [`6ceb06e`](https://github.com/tkhq/sdk/commit/6ceb06ebdbb11b017ed97e81a7e0dcb862813bfa), [`68631c4`](https://github.com/tkhq/sdk/commit/68631c4008387f845dfe4f1a139981011727f6c9)]:
  - @turnkey/sdk-types@0.6.1
  - @turnkey/core@1.4.0

## 1.2.0

### Minor Changes

- [#974](https://github.com/tkhq/sdk/pull/974) [`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c) Author [@narimonf](https://github.com/narimonf) - Added `fetchBootProofForAppProof`, which fetches the boot proof for a given app proof.

### Patch Changes

- [#973](https://github.com/tkhq/sdk/pull/973) [`48f59f9`](https://github.com/tkhq/sdk/commit/48f59f9ffe7f64ec526b40bb8e03feac8ad0d7ba) Author [@moeodeh3](https://github.com/moeodeh3) - Fix handling of providers that cannot be disconnected

- Updated dependencies [[`4adbf9b`](https://github.com/tkhq/sdk/commit/4adbf9bbb6b93f84aa80e06a1eeabd61d1dbbb86), [`4ead6da`](https://github.com/tkhq/sdk/commit/4ead6da626468fde41daf85eae90faf18651d1c1), [`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c), [`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c)]:
  - @turnkey/core@1.3.0
  - @turnkey/sdk-types@0.6.0

## 1.1.2

### Patch Changes

- Updated dependencies [[`4567059`](https://github.com/tkhq/sdk/commit/45670598f102223925b87a5295edca15a6ce8241), [`010543c`](https://github.com/tkhq/sdk/commit/010543c3b1b56a18816ea92a1a1cbe028cf988e4)]:
  - @turnkey/sdk-types@0.5.0
  - @turnkey/core@1.2.0

## 1.1.1

### Patch Changes

- [#968](https://github.com/tkhq/sdk/pull/968) [`14424ee`](https://github.com/tkhq/sdk/commit/14424eeeabb9cea8067f978051dceb0537c22e34) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed type re-exports from `@turnkey/core`

- [#962](https://github.com/tkhq/sdk/pull/962) [`62937e7`](https://github.com/tkhq/sdk/commit/62937e74e1e27093906e434c62f6f0545f73e934) Author [@moeodeh3](https://github.com/moeodeh3) - - Fixed memory leaks in `handle*` functions
  - `handleConnectExternalWallet` now returns `{ type: "connect" | "disconnect"; account?: WalletAccount }`

- [#964](https://github.com/tkhq/sdk/pull/964) [`1e15cc9`](https://github.com/tkhq/sdk/commit/1e15cc9d672905b87566324ec5b10580318fca19) Author [@moeodeh3](https://github.com/moeodeh3) - Fix `onClose` callbacks not triggering in child modal pages

## 1.1.0

### Minor Changes

- [#941](https://github.com/tkhq/sdk/pull/941) [`f2c95ae`](https://github.com/tkhq/sdk/commit/f2c95aed9c5fc56efa6ecda62e5231fc05d0c96e) Author [@ethankonk](https://github.com/ethankonk) - - Added options in the config and handleLogin() to add a logo for light and/or dark mode

- [#951](https://github.com/tkhq/sdk/pull/951) [`3ad8718`](https://github.com/tkhq/sdk/commit/3ad87184fab0e66c36276210b8c1c2c598888014) Author [@ethankonk](https://github.com/ethankonk) - - Added sheets to the modal system which popup from below within the modal. Future proofing for more OAuth methods and such

- [#944](https://github.com/tkhq/sdk/pull/944) [`e7edb0f`](https://github.com/tkhq/sdk/commit/e7edb0f7fe03ff453ddb8ff05c3283b608ad2b86) Author [@ethankonk](https://github.com/ethankonk) - Added optional name overide param for handleImportWallet & handleImportPrivateKey. If provided, the input field for wallet name will no longer be shown and the passed in name param will be used instead.

- [#931](https://github.com/tkhq/sdk/pull/931) [`f8a8d20`](https://github.com/tkhq/sdk/commit/f8a8d204ccf1831a742ecd47b2c42dc3a672dd7e) Author [@ethankonk](https://github.com/ethankonk) - - Added config option to disable managed state auto refreshing.
  - The session state is automatically cleared if a request to Turnkey returns an unauthorized error indicating that the session keypair is no longer valid.

- [#940](https://github.com/tkhq/sdk/pull/940) [`e4bc82f`](https://github.com/tkhq/sdk/commit/e4bc82fc51c692d742923ccfff72c2c862ee71a4) Author [@moeodeh3](https://github.com/moeodeh3) - - Added optional params for sessionless stamping (passkey/wallet only setups)

### Patch Changes

- [#952](https://github.com/tkhq/sdk/pull/952) [`6e3114b`](https://github.com/tkhq/sdk/commit/6e3114bd16246b0e1dcb540f30ff3a430164c2fd) Author [@amircheikh](https://github.com/amircheikh) - - Fixed broken padding on Safari using iOS 26 and MacOS 26

- [#955](https://github.com/tkhq/sdk/pull/955) [`c534b5b`](https://github.com/tkhq/sdk/commit/c534b5ba7834bf8f16a5e903b468b262972f9320) Author [@ethankonk](https://github.com/ethankonk) - Methods no longer rely on the session state variable, meaning functions that modify session can be placed in-line with methods reliant on session updates

- [#934](https://github.com/tkhq/sdk/pull/934) [`9c1fea5`](https://github.com/tkhq/sdk/commit/9c1fea51ba156c176f81ba5883e7d8c837f95c19) Author [@moeodeh3](https://github.com/moeodeh3) - Re-exported useful modules from `@turnkey/core`:
  - `TurnkeyClient`
  - `TurnkeyClientMethods`
  - `TurnkeySDKClientBase`
  - `isEthereumProvider`
  - `isSolanaProvider`

- [#954](https://github.com/tkhq/sdk/pull/954) [`474ba20`](https://github.com/tkhq/sdk/commit/474ba20e90c4d7c056d108c44fc2442a0e1cd992) Author [@moeodeh3](https://github.com/moeodeh3) - Added a Copy Link button to the WalletConnect screen in the auth component

- [#958](https://github.com/tkhq/sdk/pull/958) [`5a96fe8`](https://github.com/tkhq/sdk/commit/5a96fe80db4c4c45e09ad8c613695ee4c2b8e51f) Author [@amircheikh](https://github.com/amircheikh) - - otpLength and alphanumeric settings now properly apply from dashboard

- [#946](https://github.com/tkhq/sdk/pull/946) [`0080c4d`](https://github.com/tkhq/sdk/commit/0080c4d011a7f8d04b41d89b31863b75d1a816ef) Author [@moeodeh3](https://github.com/moeodeh3) - - Fixed double sign prompt for WalletConnect in React Dev Mode
  - Fixed expired WalletConnect URIs
  - Fixed errors on unapproved WalletConnect sessions

- [#960](https://github.com/tkhq/sdk/pull/960) [`c2a0bd7`](https://github.com/tkhq/sdk/commit/c2a0bd7ea8a53524cde16897f375f8a7088ba963) Author [@moeodeh3](https://github.com/moeodeh3) - - Removed requirement of session for external wallet usage
  - `connectExternalWalletAccount()` now returns the full `WalletAccount` object instead of `void`
  - `fetchWallets()` now supports an optional `connectedOnly` parameter to fetch only connected wallets
- Updated dependencies [[`0080c4d`](https://github.com/tkhq/sdk/commit/0080c4d011a7f8d04b41d89b31863b75d1a816ef), [`5a96fe8`](https://github.com/tkhq/sdk/commit/5a96fe80db4c4c45e09ad8c613695ee4c2b8e51f), [`c2a0bd7`](https://github.com/tkhq/sdk/commit/c2a0bd7ea8a53524cde16897f375f8a7088ba963), [`90841f9`](https://github.com/tkhq/sdk/commit/90841f95f3f738c47c04797096902d9d0a23afc7), [`e4bc82f`](https://github.com/tkhq/sdk/commit/e4bc82fc51c692d742923ccfff72c2c862ee71a4)]:
  - @turnkey/core@1.1.0
  - @turnkey/sdk-types@0.4.1

## 1.0.0

### Major Changes

- Initial Stable Release: `@turnkey/react-wallet-kit` 🎉
  Turnkey’s **Embedded Wallet Kit** is the easiest way to integrate Turnkey’s Embedded Wallets into your React applications, with no backend required.
  - Built on [`@turnkey/core`](https://www.npmjs.com/package/@turnkey/core)
  - Provides a set of UI components and simple functions, all exported through a React hook
  - Designed to help you quickly build secure embedded wallet experiences

  📚 [Read the full docs here](https://docs.turnkey.com/sdks/react)

### Minor Changes

- [#677](https://github.com/tkhq/sdk/pull/677) [`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e) Author [@amircheikh](https://github.com/amircheikh) - @turnkey/react-wallet-kit and @turnkey/core beta-3 release

- [#677](https://github.com/tkhq/sdk/pull/677) [`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e) Author [@amircheikh](https://github.com/amircheikh) - @turnkey/react-wallet-kit and @turnkey/core beta-3 release

- [#677](https://github.com/tkhq/sdk/pull/677) [`4880f26`](https://github.com/tkhq/sdk/commit/4880f26a4dd324c049bff7f35284098ccfc55823) Author [@amircheikh](https://github.com/amircheikh) - @turnkey/react-wallet-kit and @turnkey/core beta release

- [#677](https://github.com/tkhq/sdk/pull/677) [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c) Author [@amircheikh](https://github.com/amircheikh) - updating package versions

- [#677](https://github.com/tkhq/sdk/pull/677) [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c) Author [@amircheikh](https://github.com/amircheikh) - test build

- [#677](https://github.com/tkhq/sdk/pull/677) [`06347ad`](https://github.com/tkhq/sdk/commit/06347adfa08fb0867c350e43821d0fed06c49624) Author [@amircheikh](https://github.com/amircheikh) - SDK beta release @turnkey/react-wallet-kit @turnkey/core

### Patch Changes

- Updated dependencies [[`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e), [`fc1d6e2`](https://github.com/tkhq/sdk/commit/fc1d6e2d26f4a53116633e9e8cccccd792267f4e), [`4880f26`](https://github.com/tkhq/sdk/commit/4880f26a4dd324c049bff7f35284098ccfc55823), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`c6ee323`](https://github.com/tkhq/sdk/commit/c6ee3239c389a7bbbbb23610c84b883ed298f95c), [`06347ad`](https://github.com/tkhq/sdk/commit/06347adfa08fb0867c350e43821d0fed06c49624)]:
  - @turnkey/sdk-types@0.4.0
  - @turnkey/core@1.0.0
  - @turnkey/iframe-stamper@2.6.0

## 1.0.0-beta.6

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta release

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.6
  - @turnkey/core@1.0.0-beta.6

## 1.0.0-beta.5

### Minor Changes

- SDK beta release @turnkey/react-wallet-kit @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/iframe-stamper@2.6.0-beta.0
  - @turnkey/sdk-types@0.4.0-beta.5
  - @turnkey/core@1.0.0-beta.5

## 1.0.0-beta.4

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta-3 release

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.4
  - @turnkey/core@1.0.0-beta.4

## 1.0.0-beta.3

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta-3 release

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.3
  - @turnkey/core@1.0.0-beta.3

## 1.0.0-beta.2

### Minor Changes

- updating package versions

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.2
  - @turnkey/core@1.0.0-beta.2

## 1.0.0-beta.1

### Minor Changes

- test build

### Patch Changes

- Updated dependencies []:
  - @turnkey/sdk-types@0.4.0-beta.1
  - @turnkey/core@1.0.0-beta.1

## 1.0.0-beta.0

### Major Changes

- beta for @turnkey/react-wallet-kit and @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/core@1.0.0-beta.0
  - @turnkey/sdk-types@0.4.0-beta.0

## 1.0.0

### Major Changes

- Initial beta release for react wallet kit

### Patch Changes

- Updated dependencies []:
  - @turnkey/core@1.0.0
  - @turnkey/sdk-types@0.4.0

## 1.0.0

### Major Changes

- Initial beta release for @turnkey/react-wallet-kit and @turnkey/core

### Patch Changes

- Updated dependencies []:
  - @turnkey/core@1.0.0
  - @turnkey/sdk-types@0.4.0
