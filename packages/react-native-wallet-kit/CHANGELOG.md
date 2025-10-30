# @turnkey/react-native-wallet-kit

## 1.1.4

### Patch Changes

- [#1059](https://github.com/tkhq/sdk/pull/1059) [`046544f`](https://github.com/tkhq/sdk/commit/046544fa4243f31b28068f5b82917e54b8442be5) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `storeSession` not updating wallet and user state

- [#1059](https://github.com/tkhq/sdk/pull/1059) [`046544f`](https://github.com/tkhq/sdk/commit/046544fa4243f31b28068f5b82917e54b8442be5) Author [@moeodeh3](https://github.com/moeodeh3) - Fixed `expirationSeconds` param being ignored in auth functions

- Updated dependencies [[`9fbd5c4`](https://github.com/tkhq/sdk/commit/9fbd5c459782dc3721dd0935d0a4458babce258b)]:
  - @turnkey/sdk-types@0.7.0
  - @turnkey/core@1.6.0
  - @turnkey/crypto@2.8.5
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
