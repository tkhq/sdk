# @turnkey/core

## 1.12.0

### Minor Changes

- [#1206](https://github.com/tkhq/sdk/pull/1206) [`58e04e5`](https://github.com/tkhq/sdk/commit/58e04e5856626d9d2593abb61d8ca32d8ccbb833) Author [@DeRauk](https://github.com/DeRauk) - Adds sdk methods for the GetWalletAddressBalances and ListSupportedAssets apis.

### Patch Changes

- [#1209](https://github.com/tkhq/sdk/pull/1209) [`af6262f`](https://github.com/tkhq/sdk/commit/af6262f31e1abb3090fcda1eec5318056e6d51fe) Author [@moeodeh3](https://github.com/moeodeh3) - Bump `@walletconnect/sign-client` to `2.23.6` to address https://github.com/advisories/GHSA-mp2g-9vg9-f4cg

- [#1201](https://github.com/tkhq/sdk/pull/1201) [`1f6e240`](https://github.com/tkhq/sdk/commit/1f6e2403fca1fd9cbca646f88c88dbc49ddb0c34) Author [@ethankonk](https://github.com/ethankonk) - Synced with Mono v2026.2.0

- [#1197](https://github.com/tkhq/sdk/pull/1197) [`7458b7c`](https://github.com/tkhq/sdk/commit/7458b7cd6fc64796b376e3374b7c2ed79467459c) Thanks [@moe-dev](https://github.com/moe-dev)! - Add support for SolSendTransaction and associated abstractions

- Updated dependencies [[`1f6e240`](https://github.com/tkhq/sdk/commit/1f6e2403fca1fd9cbca646f88c88dbc49ddb0c34), [`58e04e5`](https://github.com/tkhq/sdk/commit/58e04e5856626d9d2593abb61d8ca32d8ccbb833), [`7458b7c`](https://github.com/tkhq/sdk/commit/7458b7cd6fc64796b376e3374b7c2ed79467459c)]:
  - @turnkey/sdk-types@0.12.0
  - @turnkey/http@3.17.0
  - @turnkey/crypto@2.8.11
  - @turnkey/react-native-passkey-stamper@1.2.10
  - @turnkey/api-key-stamper@0.6.2

## 1.11.2

### Patch Changes

- [#1188](https://github.com/tkhq/sdk/pull/1188) [`d49ef7e`](https://github.com/tkhq/sdk/commit/d49ef7e9f0f78f16b1324a357f61cf0351198096) Author [@moeodeh3](https://github.com/moeodeh3) - Scope keychain storage to Turnkey keys by prefixing service names. This fixes an issue where `clearUnusedKeyPairs()` was deleting non-Turnkey keychain entries.

- [#1194](https://github.com/tkhq/sdk/pull/1194) [`dced9db`](https://github.com/tkhq/sdk/commit/dced9dbbd8ea533442e19e45ce36e6a05a45a555) Author [@moeodeh3](https://github.com/moeodeh3) - Add `Content-Type: application/json` header to all Turnkey API requests. The missing header caused "Network request failed" errors on React Native, intermittent for some setups and consistent for others, where OkHttp-backed fetch can reject `POST` requests without an explicit `Content-Type`. See also: https://github.com/JakeChampion/fetch/issues/823

  Special thanks to @jrmykolyn and @niroshanS for helping identify and debug this issue

- Updated dependencies [[`dced9db`](https://github.com/tkhq/sdk/commit/dced9dbbd8ea533442e19e45ce36e6a05a45a555)]:
  - @turnkey/http@3.16.3
  - @turnkey/react-native-passkey-stamper@1.2.9

## 1.11.1

### Patch Changes

- [#1171](https://github.com/tkhq/sdk/pull/1171) [`2d19991`](https://github.com/tkhq/sdk/commit/2d19991bcf4e1c9704b73a48c54e870373b4bd95) Author [@moeodeh3](https://github.com/moeodeh3) - Fix mobile `setActiveSessionKey()` to JSON stringify session key. This fixes parsing errors in `getActiveSessionKey()`

- [#1177](https://github.com/tkhq/sdk/pull/1177) [`89d4084`](https://github.com/tkhq/sdk/commit/89d40844d791b0bbb6d439da5e778b1fdeca4273) Author [@moeodeh3](https://github.com/moeodeh3) - Add a 1-second timeout to external wallet provider discovery. This prevents hanging providers from blocking `fetchUser()` and `fetchWallet()`

- [#1174](https://github.com/tkhq/sdk/pull/1174) [`ba2521d`](https://github.com/tkhq/sdk/commit/ba2521d5d1c1f6baaa58ee65dce8cc4839f7dc7b) Author [@ethankonk](https://github.com/ethankonk) - Fixed bug preventing sub-orgs from adding Google social providers when the parsed email matches their user email

- [#1185](https://github.com/tkhq/sdk/pull/1185) [`12ca083`](https://github.com/tkhq/sdk/commit/12ca083314310b05cf41ac29fa2d55eed627f229) Author [@moeodeh3](https://github.com/moeodeh3) - Remove leading whitespaces in wallet provider icon URLs

- [#1179](https://github.com/tkhq/sdk/pull/1179) [`a85153c`](https://github.com/tkhq/sdk/commit/a85153c8ccc7454cd5aca974bc463fb47c7f8cd4) Author [@moeodeh3](https://github.com/moeodeh3) - - Fix `loginWithWallet()` returning the wrong address and sporadically failing
  - Deprecate `sendSignedRequest()` in favor of `httpClient.sendSignedRequest()`, which includes automatic activity polling and result extraction
- Updated dependencies [[`8e075b7`](https://github.com/tkhq/sdk/commit/8e075b7161ccc68cb446b10b54737856fa0c6d31)]:
  - @turnkey/sdk-types@0.11.2
  - @turnkey/crypto@2.8.10
  - @turnkey/api-key-stamper@0.6.1
  - @turnkey/http@3.16.2
  - @turnkey/react-native-passkey-stamper@1.2.8

## 1.11.0

### Minor Changes

- [#1135](https://github.com/tkhq/sdk/pull/1135) [`91d6a9e`](https://github.com/tkhq/sdk/commit/91d6a9eb1b9ac9e21745749615ac7a7be66f5cf6) Author [@ethankonk](https://github.com/ethankonk) - - Added client signature support for OTP authentication flows
  - Synced with `mono` v2025.12.2

### Patch Changes

- [#1117](https://github.com/tkhq/sdk/pull/1117) [`699fbd7`](https://github.com/tkhq/sdk/commit/699fbd75ef3f44f768ae641ab4f652e966b8e289) Author [@ethankonk](https://github.com/ethankonk) - Fixed broken OTP flow when "Verification Token Required for Account Lookups" was enabled in the Auth Proxy

- Updated dependencies [[`d0dba04`](https://github.com/tkhq/sdk/commit/d0dba0412fa7b0c7c9b135e73cc0ef6f55187314), [`91d6a9e`](https://github.com/tkhq/sdk/commit/91d6a9eb1b9ac9e21745749615ac7a7be66f5cf6), [`91d6a9e`](https://github.com/tkhq/sdk/commit/91d6a9eb1b9ac9e21745749615ac7a7be66f5cf6)]:
  - @turnkey/crypto@2.8.9
  - @turnkey/api-key-stamper@0.6.0
  - @turnkey/sdk-types@0.11.1
  - @turnkey/http@3.16.1
  - @turnkey/react-native-passkey-stamper@1.2.7

## 1.10.0

### Minor Changes

- [#1153](https://github.com/tkhq/sdk/pull/1153) [`78ec1d9`](https://github.com/tkhq/sdk/commit/78ec1d9afcafde3ca7107fc720323d486d6afaea) Thanks [@moe-dev](https://github.com/moe-dev)! - Update as per mono v2025.12.3.

  ### Behavioral Changes
  - `appName` is now **required**:
    - In `emailCustomization` for Email Auth activities
    - At the top-level intent for OTP activities
  - Auth proxy endpoints are **not affected**

  ### Activity Version Bumps

  The following activity types have been versioned:
  - `ACTIVITY_TYPE_INIT_OTP` → `ACTIVITY_TYPE_INIT_OTP_V2`
  - `ACTIVITY_TYPE_INIT_OTP_AUTH_V2` → `ACTIVITY_TYPE_INIT_OTP_V3`
  - `ACTIVITY_TYPE_EMAIL_AUTH_V2` → `ACTIVITY_TYPE_EMAIL_AUTH_V3`
  - `ACTIVITY_TYPE_INIT_USER_EMAIL_RECOVERY` -> `ACTIVITY_TYPE_INIT_USER_EMAIL_RECOVERY_V2`

### Patch Changes

- [#1145](https://github.com/tkhq/sdk/pull/1145) [`6261eed`](https://github.com/tkhq/sdk/commit/6261eed95af8627bf1e95e7291b9760a2267e301) Author [@moeodeh3](https://github.com/moeodeh3) - Add session `organizationId` fallback to HTTP client stamp functions

- Updated dependencies [[`78ec1d9`](https://github.com/tkhq/sdk/commit/78ec1d9afcafde3ca7107fc720323d486d6afaea)]:
  - @turnkey/sdk-types@0.11.0
  - @turnkey/http@3.16.0
  - @turnkey/crypto@2.8.8
  - @turnkey/react-native-passkey-stamper@1.2.6

## 1.9.0

### Minor Changes

- [#1118](https://github.com/tkhq/sdk/pull/1118) [`29a42db`](https://github.com/tkhq/sdk/commit/29a42db8f5f3ef8b9c23c90cd00f4c21027aac2e) Thanks [@moe-dev](https://github.com/moe-dev)! - Add support for high-level Ethereum transaction utilities (**for embedded wallet use only**):
  - **`ethSendTransaction`** — new helper used as a dedicated method for submitting Ethereum transactions (sign and broadcast) via the Turnkey API.
  - **`pollTransactionStatus`** — new helper for polling Turnkey’s transaction status endpoint until the transaction reaches a terminal state.

  These methods enable a clean two-step flow:
  1. Submit the transaction intent using `ethSendTransaction`, receiving a `sendTransactionStatusId`.
  2. Poll for completion using `pollTransactionStatus` to retrieve the final on-chain transaction hash and execution status.

### Patch Changes

- Updated dependencies [[`29a42db`](https://github.com/tkhq/sdk/commit/29a42db8f5f3ef8b9c23c90cd00f4c21027aac2e)]:
  - @turnkey/sdk-types@0.10.0
  - @turnkey/crypto@2.8.7

## 1.8.3

### Patch Changes

- [#1136](https://github.com/tkhq/sdk/pull/1136) [`7185545`](https://github.com/tkhq/sdk/commit/7185545ea1fc05eb738af09de5a594455f2e08f3) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed missing `X-Client-Version` header in `sendSignedRequest()`

## 1.8.2

### Patch Changes

- [#1127](https://github.com/tkhq/sdk/pull/1127) [`3c23fc2`](https://github.com/tkhq/sdk/commit/3c23fc27eda5325a90e79afff4cc3a16f682e1d9) Author [@moeodeh3](https://github.com/moeodeh3) - Fix duplicate providers returned by `fetchWalletProviders()` when external wallet providers announce multiple EIP-1193 providers (e.g., Backpack)

## 1.8.1

### Patch Changes

- [#1113](https://github.com/tkhq/sdk/pull/1113) [`d4768c7`](https://github.com/tkhq/sdk/commit/d4768c71b6796532c9800d546154116e5d36b255) Author [@moeodeh3](https://github.com/moeodeh3) - Prevented unnecessary permission prompts in non-Ethereum-native wallets (e.g., Cosmos-based wallets like Keplr) by avoiding chainId requests before accounts are connected

## 1.8.0

### Minor Changes

- [#1090](https://github.com/tkhq/sdk/pull/1090) [`e1bd68f`](https://github.com/tkhq/sdk/commit/e1bd68f963d6bbd9c797b1a8f077efadccdec421) Author [@moeodeh3](https://github.com/moeodeh3) - - Fixed `stamp*` methods for query endpoints in `httpClient` incorrectly formatting request body
  - Parallelized stamper and session initialization
  - Separated WalletConnect initialization from client init
  - Optimized `fetchWallet` by reducing redundant queries and running wallet/user fetches in parallel
  - Added optional `authenticatorAddresses` param to `fetchWalletAccounts()`
  - Updated to latest `@walletconnect/sign-client` for performance improvements

### Patch Changes

- [#1096](https://github.com/tkhq/sdk/pull/1096) [`fd2e031`](https://github.com/tkhq/sdk/commit/fd2e0318079de922512b1f5adb404b11921f77b7) Author [@ethankonk](https://github.com/ethankonk) - Fixed legacy transactions not working in `signAndSendTransaction()` for **EVM connected wallet**. This does not affect Turnkey's embedded wallet flow, previously, connected wallet transactions were all formatted into EIP-1559 transactions, updated to respect legacy + future formats passed in.

- Updated dependencies [[`80ea306`](https://github.com/tkhq/sdk/commit/80ea306025a2161ff575a5e2b45794460eafdf1b)]:
  - @turnkey/sdk-types@0.9.0
  - @turnkey/crypto@2.8.6

## 1.7.0

### Minor Changes

- [#1072](https://github.com/tkhq/sdk/pull/1072) [`67b03a5`](https://github.com/tkhq/sdk/commit/67b03a5d9ab1b6eabfb0b41938ac91365b5dcd9b) Thanks [@moe-dev](https://github.com/moe-dev)! - Bump packages as per mono v2025.11.0

### Patch Changes

- [#1074](https://github.com/tkhq/sdk/pull/1074) [`beee465`](https://github.com/tkhq/sdk/commit/beee465a13f64abeb71c5c00519f7abab9942607) Author [@moeodeh3](https://github.com/moeodeh3) - - added optional `organizationId` to `loginWithOAuth()`
  - added optional `invalidateExisting` to `signUpWithOAuth()`
  - fixed `invalidateExisting` being ignored in `completeOAuth()` during signup
- Updated dependencies [[`5f829c6`](https://github.com/tkhq/sdk/commit/5f829c67af03bb85c3806acd202b2debf8274e78), [`084acce`](https://github.com/tkhq/sdk/commit/084acce85fe7c15513a025e77c1571012ac82e4b), [`67b03a5`](https://github.com/tkhq/sdk/commit/67b03a5d9ab1b6eabfb0b41938ac91365b5dcd9b)]:
  - @turnkey/crypto@2.8.5
  - @turnkey/sdk-types@0.8.0
  - @turnkey/http@3.15.0
  - @turnkey/react-native-passkey-stamper@1.2.5

## 1.6.0

### Minor Changes

- [#1058](https://github.com/tkhq/sdk/pull/1058) [`9fbd5c4`](https://github.com/tkhq/sdk/commit/9fbd5c459782dc3721dd0935d0a4458babce258b) Author [@moeodeh3](https://github.com/moeodeh3) - Update per mono release `v2025.10.10-hotfix.2`

### Patch Changes

- Updated dependencies [[`9fbd5c4`](https://github.com/tkhq/sdk/commit/9fbd5c459782dc3721dd0935d0a4458babce258b)]:
  - @turnkey/http@3.14.0
  - @turnkey/crypto@2.8.4
  - @turnkey/react-native-passkey-stamper@1.2.4

## 1.5.2

### Patch Changes

- Updated dependencies [[`c745646`](https://github.com/tkhq/sdk/commit/c745646ae4b2a275e116abca07c6e108f89beb04)]:
  - @turnkey/crypto@2.8.4

## 1.5.1

### Patch Changes

- [#1031](https://github.com/tkhq/sdk/pull/1031) [`886f319`](https://github.com/tkhq/sdk/commit/886f319fab8b0ba560d040e34598436f3beceff0) Author [@ethankonk](https://github.com/ethankonk) - Fixed session token getting cleared when using loginWithWallet

## 1.5.0

### Minor Changes

- [#992](https://github.com/tkhq/sdk/pull/992) [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186) Author [@amircheikh](https://github.com/amircheikh) - - Added `verifyAppProofs` function. Used alongside activities that return app proofs, this function will fetch the corresponding boot proof for a list of app proofs and securely verify them on the client. Learn more about Turnkey Verified [here](https://docs.turnkey.com/security/turnkey-verified)
  - All auth methods that make signup requests now optionally return a list of `appProofs`

### Patch Changes

- [#1020](https://github.com/tkhq/sdk/pull/1020) [`001d822`](https://github.com/tkhq/sdk/commit/001d8225202500e53aa399d6aee0c8f48f6060e0) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed an issue in `signAndSendTransaction` where Ethereum embedded wallet transactions failed during broadcast due to missing `0x` prefixes

- Updated dependencies [[`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186), [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186)]:
  - @turnkey/crypto@2.8.3
  - @turnkey/sdk-types@0.6.3

## 1.4.2

### Patch Changes

- [#1016](https://github.com/tkhq/sdk/pull/1016) [`9df42ad`](https://github.com/tkhq/sdk/commit/9df42adc02c7ff77afba3b938536e79b57882ef1) Author [@amircheikh](https://github.com/amircheikh) - Synced API as per mono v2025.10.2

- Updated dependencies [[`9df42ad`](https://github.com/tkhq/sdk/commit/9df42adc02c7ff77afba3b938536e79b57882ef1), [`429e4c4`](https://github.com/tkhq/sdk/commit/429e4c4b5d897a7233584d4ec429b21bba7a1f2b)]:
  - @turnkey/sdk-types@0.6.2
  - @turnkey/http@3.13.1
  - @turnkey/react-native-passkey-stamper@1.2.3
  - @turnkey/crypto@2.8.2

## 1.4.1

### Patch Changes

- [#1010](https://github.com/tkhq/sdk/pull/1010) [`e5b9c5c`](https://github.com/tkhq/sdk/commit/e5b9c5c5694b1f4d60c0b8606822bcd6d61da4a3) Author [@moeodeh3](https://github.com/moeodeh3) - - Fixed errors not being deserialized in `withTurnkeyErrorHandling()`, which previously caused them to stringify as `[object Object]`
  - Improved error messages surfaced by `connectWalletAccount()`

## 1.4.0

### Minor Changes

- [#986](https://github.com/tkhq/sdk/pull/986) [`6ceb06e`](https://github.com/tkhq/sdk/commit/6ceb06ebdbb11b017ed97e81a7e0dcb862813bfa) Author [@amircheikh](https://github.com/amircheikh) - - Added `defaultStamperType` param to the configuration. This will force the underlying `httpClient` to default to a specific stamper for all requests
  - Added `createHttpClient` function. This allows a duplicate instance of `TurnkeySDKClientBase` to be created and returned. Custom configuration can be passed in to create an entirely new client with a unique config. This is useful for creating different HTTP clients with different default stampers to be used in our helper packages (`@turnkey/viem`, `@turnkey/ethers`, etc)

- [#993](https://github.com/tkhq/sdk/pull/993) [`68631c4`](https://github.com/tkhq/sdk/commit/68631c4008387f845dfe4f1a139981011727f6c9) Author [@moeodeh3](https://github.com/moeodeh3) - - Added `sendSignedRequest()` to execute any `TSignedRequest` returned by SDK stamping methods.
  - Added `buildWalletLoginRequest()` method, which prepares and signs a wallet login request without sending it to Turnkey, returning the `stampLogin` signed request alongside the wallet’s public key used for login.

### Patch Changes

- Updated dependencies [[`68631c4`](https://github.com/tkhq/sdk/commit/68631c4008387f845dfe4f1a139981011727f6c9)]:
  - @turnkey/sdk-types@0.6.1
  - @turnkey/crypto@2.8.1

## 1.3.0

### Minor Changes

- [#974](https://github.com/tkhq/sdk/pull/974) [`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c) Author [@narimonf](https://github.com/narimonf) - Added `fetchBootProofForAppProof`, which fetches the boot proof for a given app proof.

### Patch Changes

- [#982](https://github.com/tkhq/sdk/pull/982) [`4adbf9b`](https://github.com/tkhq/sdk/commit/4adbf9bbb6b93f84aa80e06a1eeabd61d1dbbb86) Author [@ethankonk](https://github.com/ethankonk) - - Fixed signing and broadcasting transactions with connected solana accounts
  - Fixed `fetchWallets` wallet account pagination issue

- [#983](https://github.com/tkhq/sdk/pull/983) [`4ead6da`](https://github.com/tkhq/sdk/commit/4ead6da626468fde41daf85eae90faf18651d1c1) Author [@moeodeh3](https://github.com/moeodeh3) - WalletConnect initialization now has a 5-second timeout. If setup fails, it no longer blocks overall client initialization

- Updated dependencies [[`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c), [`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c)]:
  - @turnkey/crypto@2.8.0
  - @turnkey/sdk-types@0.6.0

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
