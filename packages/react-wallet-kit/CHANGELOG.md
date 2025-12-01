# @turnkey/react-wallet-kit

## 1.6.1

### Patch Changes

- Updated dependencies [[`d4768c7`](https://github.com/tkhq/sdk/commit/d4768c71b6796532c9800d546154116e5d36b255), [`7ac558c`](https://github.com/tkhq/sdk/commit/7ac558c39c3fa0ddeb6e695182a49f03ee6d4f00)]:
  - @turnkey/core@1.8.1
  - @turnkey/iframe-stamper@2.8.0

## 1.6.0

### Minor Changes

- [#1090](https://github.com/tkhq/sdk/pull/1090) [`e1bd68f`](https://github.com/tkhq/sdk/commit/e1bd68f963d6bbd9c797b1a8f077efadccdec421) Author [@moeodeh3](https://github.com/moeodeh3) - - Fixed unnecessary re-renders by ensuring all `useCallback` hooks include only direct dependencies
  - ConnectWallet and Auth model updated to show WalletConnect loading state during initialization

### Patch Changes

- [#1102](https://github.com/tkhq/sdk/pull/1102) [`8ed182a`](https://github.com/tkhq/sdk/commit/8ed182aa95218b348d1f8e79c235ce86f418e0bf) Author [@amircheikh](https://github.com/amircheikh) - - Added `autoFetchWalletKitConfig` option to the `TurnkeyProvider` config. Setting this to false will disable the initial `walletKitConfig` fetch, saving on initialization time. If this is disabled and you want to use the `handleLogin` modal with Turnkey's Auth Proxy, you must pass in the enabled auth methods manually into the `TurnkeyProvider` config.
  - Fixed `refreshWallets` and `refreshUser` not working when `autoRefreshManagedState` is disabled.

- Updated dependencies [[`fd2e031`](https://github.com/tkhq/sdk/commit/fd2e0318079de922512b1f5adb404b11921f77b7), [`80ea306`](https://github.com/tkhq/sdk/commit/80ea306025a2161ff575a5e2b45794460eafdf1b), [`e1bd68f`](https://github.com/tkhq/sdk/commit/e1bd68f963d6bbd9c797b1a8f077efadccdec421)]:
  - @turnkey/core@1.8.0
  - @turnkey/sdk-types@0.9.0

## 1.5.1

### Patch Changes

- [#1086](https://github.com/tkhq/sdk/pull/1086) [`2fd1d55`](https://github.com/tkhq/sdk/commit/2fd1d5555dd358a1c0210ca65fd6ca70ff172058) Author [@amircheikh](https://github.com/amircheikh) - Added optional `clearClipboardOnPaste` to `handleImportWallet` and `handleImportPrivateKey`. Defaulting to true, this will create the import iframe with `clipboard-write` permissions. Allows clipboard to be cleared after pasting in secrets to import.

- [#1083](https://github.com/tkhq/sdk/pull/1083) [`658b89c`](https://github.com/tkhq/sdk/commit/658b89c9036f03ec52963ca0a4ea68d00f39e94e) Thanks [@moe-dev](https://github.com/moe-dev)! - Minor fixes - change on-ramp to onramp and change sandbox info text to match primary colour

- Updated dependencies [[`2fd1d55`](https://github.com/tkhq/sdk/commit/2fd1d5555dd358a1c0210ca65fd6ca70ff172058)]:
  - @turnkey/iframe-stamper@2.7.1

## 1.5.0

### Minor Changes

- [#1062](https://github.com/tkhq/sdk/pull/1062) [`084acce`](https://github.com/tkhq/sdk/commit/084acce85fe7c15513a025e77c1571012ac82e4b) Thanks [@moe-dev](https://github.com/moe-dev)! - - **Added `handleOnRamp()` helper** to simplify fiat-to-crypto on-ramping flows directly from the SDK.
  - Supports overriding defaults through optional parameters:
    - `network` (e.g., `FiatOnRampBlockchainNetwork.ETHEREUM`)
    - `cryptoCurrencyCode` (e.g., `FiatOnRampCryptoCurrency.ETHEREUM`)
    - `fiatCurrencyAmount`, `fiatCurrencyCode`, `paymentMethod`, and `onrampProvider`.
  - Integrates seamlessly with the `client.httpClient.initFiatOnRamp()` method to open a provider popup (Coinbase, MoonPay, etc.) and monitor transaction completion.

### Patch Changes

- Updated dependencies [[`beee465`](https://github.com/tkhq/sdk/commit/beee465a13f64abeb71c5c00519f7abab9942607), [`084acce`](https://github.com/tkhq/sdk/commit/084acce85fe7c15513a025e77c1571012ac82e4b), [`67b03a5`](https://github.com/tkhq/sdk/commit/67b03a5d9ab1b6eabfb0b41938ac91365b5dcd9b)]:
  - @turnkey/core@1.7.0
  - @turnkey/sdk-types@0.8.0

## 1.4.3

### Patch Changes

- [#1059](https://github.com/tkhq/sdk/pull/1059) [`046544f`](https://github.com/tkhq/sdk/commit/046544fa4243f31b28068f5b82917e54b8442be5) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `storeSession` not updating wallet and user state

- Updated dependencies [[`9fbd5c4`](https://github.com/tkhq/sdk/commit/9fbd5c459782dc3721dd0935d0a4458babce258b)]:
  - @turnkey/core@1.6.0

## 1.4.2

### Patch Changes

- [#1049](https://github.com/tkhq/sdk/pull/1049) [`4ea9649`](https://github.com/tkhq/sdk/commit/4ea9649f458b7f24f68bc2b64264128928bfc89b) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `userId` param being ignored in handleUpdateUserName and handleAddPhoneNumber

- [#1049](https://github.com/tkhq/sdk/pull/1049) [`c9f29a4`](https://github.com/tkhq/sdk/commit/c9f29a4bb19a4f7ded7ecc8dc7e53994aa45be63) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `expirationSeconds` param being ignored in auth functions

- Updated dependencies []:
  - @turnkey/core@1.5.2

## 1.4.1

### Patch Changes

- Updated dependencies [[`886f319`](https://github.com/tkhq/sdk/commit/886f319fab8b0ba560d040e34598436f3beceff0)]:
  - @turnkey/core@1.5.1

## 1.4.0

### Minor Changes

- [#992](https://github.com/tkhq/sdk/pull/992) [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186) Author [@amircheikh](https://github.com/amircheikh) - - Added `verifyAppProofs` function. Used alongside activities that return app proofs, this function will fetch the corresponding boot proof for a list of app proofs and securely verify them on the client. Learn more about Turnkey Verified [here](https://docs.turnkey.com/security/turnkey-verified)
  - All auth methods that make signup requests now optionally return a list of `appProofs`
  - Added `handleVerifyAppProofs` function. This will do the same actions as `verifyAppProofs` but will also show a loading and confirmation modal
  - Added `verifyWalletOnSignup` param to the `TurnkeyProvider` config. This will automatically run `handleVerifyAppProofs` after a successful signup

### Patch Changes

- Updated dependencies [[`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186), [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186), [`001d822`](https://github.com/tkhq/sdk/commit/001d8225202500e53aa399d6aee0c8f48f6060e0)]:
  - @turnkey/core@1.5.0
  - @turnkey/sdk-types@0.6.3

## 1.3.3

### Patch Changes

- [#1012](https://github.com/tkhq/sdk/pull/1012) [`9e123eb`](https://github.com/tkhq/sdk/commit/9e123eb154df7183bef002c7f94c57a72c6ef81b) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `switchWalletAccountChain` referencing stale `walletProvider` state

- Updated dependencies [[`9df42ad`](https://github.com/tkhq/sdk/commit/9df42adc02c7ff77afba3b938536e79b57882ef1)]:
  - @turnkey/sdk-types@0.6.2
  - @turnkey/core@1.4.2

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
