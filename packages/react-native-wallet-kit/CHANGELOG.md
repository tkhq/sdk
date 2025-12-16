# @turnkey/react-native-wallet-kit

## 1.3.0

### Minor Changes

- [#1118](https://github.com/tkhq/sdk/pull/1118) [`29a42db`](https://github.com/tkhq/sdk/commit/29a42db8f5f3ef8b9c23c90cd00f4c21027aac2e) Thanks [@moe-dev](https://github.com/moe-dev)! - Add support for high-level Ethereum transaction utilities:
  - **`ethSendTransaction`** — new helper used as a dedicated method for submitting Ethereum transactions (sign and broadcast) via the Turnkey API.
  - **`pollTransactionStatus`** — new helper for polling Turnkey’s transaction status endpoint until the transaction reaches a terminal state.

  These methods enable a clean two-step flow:
  1. Submit the transaction intent using `ethSendTransaction`, receiving a `sendTransactionStatusId`.
  2. Poll for completion using `pollTransactionStatus` to retrieve the final on-chain transaction hash and execution status.

### Patch Changes

- Updated dependencies [[`29a42db`](https://github.com/tkhq/sdk/commit/29a42db8f5f3ef8b9c23c90cd00f4c21027aac2e), [`29a42db`](https://github.com/tkhq/sdk/commit/29a42db8f5f3ef8b9c23c90cd00f4c21027aac2e)]:
  - @turnkey/sdk-types@0.10.0
  - @turnkey/core@1.9.0
  - @turnkey/crypto@2.8.7

## 1.2.1

### Patch Changes

- Updated dependencies [[`7185545`](https://github.com/tkhq/sdk/commit/7185545ea1fc05eb738af09de5a594455f2e08f3)]:
  - @turnkey/core@1.8.3

## 1.2.0

### Minor Changes

- [#1119](https://github.com/tkhq/sdk/pull/1119) [`ea9885b`](https://github.com/tkhq/sdk/commit/ea9885bd0c69f0dd2e1b3c695639d90184194019) Author [@moeodeh3](https://github.com/moeodeh3) - Export shared types from `@turnkey/core`

### Patch Changes

- [#1123](https://github.com/tkhq/sdk/pull/1123) [`3d743df`](https://github.com/tkhq/sdk/commit/3d743df46f029afb8664e495934fd7811d415597) Author [@moeodeh3](https://github.com/moeodeh3) - Fix AsyncStorage import for OAuth 2.0 flows (Discord, X) to support bundlers with non-standard CJS/ESM interop

- Updated dependencies [[`3c23fc2`](https://github.com/tkhq/sdk/commit/3c23fc27eda5325a90e79afff4cc3a16f682e1d9)]:
  - @turnkey/core@1.8.2

## 1.1.7

### Patch Changes

- Updated dependencies [[`d4768c7`](https://github.com/tkhq/sdk/commit/d4768c71b6796532c9800d546154116e5d36b255)]:
  - @turnkey/core@1.8.1

## 1.1.6

### Patch Changes

- [#1102](https://github.com/tkhq/sdk/pull/1102) [`8ed182a`](https://github.com/tkhq/sdk/commit/8ed182aa95218b348d1f8e79c235ce86f418e0bf) Author [@amircheikh](https://github.com/amircheikh) - - Added `autoFetchWalletKitConfig` option to the `TurnkeyProvider` config. Setting this to false will disable the initial `walletKitConfig` fetch, saving on initialization time. If this is disabled and you want to use the `handleLogin` modal with Turnkey's Auth Proxy, you must pass in the enabled auth methods manually into the `TurnkeyProvider` config.
  - Fixed `refreshWallets` and `refreshUser` not working when `autoRefreshManagedState` is disabled.

- Updated dependencies [[`fd2e031`](https://github.com/tkhq/sdk/commit/fd2e0318079de922512b1f5adb404b11921f77b7), [`80ea306`](https://github.com/tkhq/sdk/commit/80ea306025a2161ff575a5e2b45794460eafdf1b), [`e1bd68f`](https://github.com/tkhq/sdk/commit/e1bd68f963d6bbd9c797b1a8f077efadccdec421)]:
  - @turnkey/core@1.8.0
  - @turnkey/sdk-types@0.9.0
  - @turnkey/crypto@2.8.6

## 1.1.5

### Patch Changes

- Updated dependencies [[`5f829c6`](https://github.com/tkhq/sdk/commit/5f829c67af03bb85c3806acd202b2debf8274e78), [`beee465`](https://github.com/tkhq/sdk/commit/beee465a13f64abeb71c5c00519f7abab9942607), [`084acce`](https://github.com/tkhq/sdk/commit/084acce85fe7c15513a025e77c1571012ac82e4b), [`67b03a5`](https://github.com/tkhq/sdk/commit/67b03a5d9ab1b6eabfb0b41938ac91365b5dcd9b)]:
  - @turnkey/crypto@2.8.5
  - @turnkey/core@1.7.0
  - @turnkey/sdk-types@0.8.0
  - @turnkey/react-native-passkey-stamper@1.2.5

## 1.1.4

### Patch Changes

- [#1059](https://github.com/tkhq/sdk/pull/1059) [`046544f`](https://github.com/tkhq/sdk/commit/046544fa4243f31b28068f5b82917e54b8442be5) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `storeSession` not updating wallet and user state

- [#1059](https://github.com/tkhq/sdk/pull/1059) [`046544f`](https://github.com/tkhq/sdk/commit/046544fa4243f31b28068f5b82917e54b8442be5) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `expirationSeconds` param being ignored in auth functions

- Updated dependencies [[`9fbd5c4`](https://github.com/tkhq/sdk/commit/9fbd5c459782dc3721dd0935d0a4458babce258b)]:
  - @turnkey/core@1.6.0
  - @turnkey/crypto@2.8.4
  - @turnkey/react-native-passkey-stamper@1.2.4

## 1.1.3

### Patch Changes

- Updated dependencies [[`c745646`](https://github.com/tkhq/sdk/commit/c745646ae4b2a275e116abca07c6e108f89beb04)]:
  - @turnkey/crypto@2.8.4
  - @turnkey/core@1.5.2

## 1.1.2

### Patch Changes

- [#1025](https://github.com/tkhq/sdk/pull/1025) [`4bfcc1b`](https://github.com/tkhq/sdk/commit/4bfcc1b7eaea3f50bc1f7f7cab851d46f711e671) Author [@taylorjdawson](https://github.com/taylorjdawson) - Fixes clientState initialization and oauth function types

## 1.1.1

### Patch Changes

- Updated dependencies [[`886f319`](https://github.com/tkhq/sdk/commit/886f319fab8b0ba560d040e34598436f3beceff0)]:
  - @turnkey/core@1.5.1

## 1.1.0

### Minor Changes

- [#992](https://github.com/tkhq/sdk/pull/992) [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186) Author [@amircheikh](https://github.com/amircheikh) - - Added `verifyAppProofs` function. Used alongside activities that return app proofs, this function will fetch the corresponding boot proof for a list of app proofs and securely verify them on the client. Learn more about Turnkey Verified [here](https://docs.turnkey.com/security/turnkey-verified)
  - All auth methods that make signup requests now optionally return a list of `appProofs`

### Patch Changes

- [#1024](https://github.com/tkhq/sdk/pull/1024) [`45e7967`](https://github.com/tkhq/sdk/commit/45e7967e30efd87eaa3f7bf4e732e95b44a8505d) Author [@moeodeh3](https://github.com/moeodeh3) - Removed unintended space from TURNKEY_OAUTH_REDIRECT_URL

- Updated dependencies [[`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186), [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186), [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186), [`001d822`](https://github.com/tkhq/sdk/commit/001d8225202500e53aa399d6aee0c8f48f6060e0)]:
  - @turnkey/crypto@2.8.3
  - @turnkey/core@1.5.0
  - @turnkey/sdk-types@0.6.3

## 1.0.1

### Patch Changes

- Updated dependencies [[`9df42ad`](https://github.com/tkhq/sdk/commit/9df42adc02c7ff77afba3b938536e79b57882ef1), [`429e4c4`](https://github.com/tkhq/sdk/commit/429e4c4b5d897a7233584d4ec429b21bba7a1f2b)]:
  - @turnkey/sdk-types@0.6.2
  - @turnkey/core@1.4.2
  - @turnkey/react-native-passkey-stamper@1.2.3
  - @turnkey/crypto@2.8.2

## 1.0.0

### Patch Changes

- Updated dependencies [[`e5b9c5c`](https://github.com/tkhq/sdk/commit/e5b9c5c5694b1f4d60c0b8606822bcd6d61da4a3)]:
  - @turnkey/core@1.4.1
