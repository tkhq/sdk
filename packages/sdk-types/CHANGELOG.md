# @turnkey/sdk-types

## 0.11.0

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

## 0.10.0

### Minor Changes

- [#1118](https://github.com/tkhq/sdk/pull/1118) [`29a42db`](https://github.com/tkhq/sdk/commit/29a42db8f5f3ef8b9c23c90cd00f4c21027aac2e) Thanks [@moe-dev](https://github.com/moe-dev)! - Update as per mono v2025.12.2

## 0.9.0

### Minor Changes

- [#1090](https://github.com/tkhq/sdk/pull/1090) [`80ea306`](https://github.com/tkhq/sdk/commit/80ea306025a2161ff575a5e2b45794460eafdf1b) Author [@moeodeh3](https://github.com/moeodeh3) - Added `WALLET_CONNECT_INITIALIZATION_ERROR` error code

## 0.8.0

### Minor Changes

- [#1062](https://github.com/tkhq/sdk/pull/1062) [`084acce`](https://github.com/tkhq/sdk/commit/084acce85fe7c15513a025e77c1571012ac82e4b) Thanks [@moe-dev](https://github.com/moe-dev)! - - **Added `handleOnRamp()` helper** to simplify fiat-to-crypto on-ramping flows directly from the SDK.
  - Supports overriding defaults through optional parameters:
    - `network` (e.g., `FiatOnRampBlockchainNetwork.ETHEREUM`)
    - `cryptoCurrencyCode` (e.g., `FiatOnRampCryptoCurrency.ETHEREUM`)
    - `fiatCurrencyAmount`, `fiatCurrencyCode`, `paymentMethod`, and `onrampProvider`.
  - Integrates seamlessly with the `client.httpClient.initFiatOnRamp()` method to open a provider popup (Coinbase, MoonPay, etc.) and monitor transaction completion.

- [#1072](https://github.com/tkhq/sdk/pull/1072) [`67b03a5`](https://github.com/tkhq/sdk/commit/67b03a5d9ab1b6eabfb0b41938ac91365b5dcd9b) Thanks [@moe-dev](https://github.com/moe-dev)! - Bump packages as per mono v2025.11.0

## 0.7.0

### Minor Changes

- [#1058](https://github.com/tkhq/sdk/pull/1058) [`9fbd5c4`](https://github.com/tkhq/sdk/commit/9fbd5c459782dc3721dd0935d0a4458babce258b) Author [@moeodeh3](https://github.com/moeodeh3) - Update per mono release `v2025.10.10-hotfix.2`

## 0.6.3

### Patch Changes

- [#992](https://github.com/tkhq/sdk/pull/992) [`5c4495b`](https://github.com/tkhq/sdk/commit/5c4495bff1b0abfe3c427ead1b8e1a8d510c8186) Author [@amircheikh](https://github.com/amircheikh) - - Added `appProofs` to `BaseAuthResult`

## 0.6.2

### Patch Changes

- [#1016](https://github.com/tkhq/sdk/pull/1016) [`9df42ad`](https://github.com/tkhq/sdk/commit/9df42adc02c7ff77afba3b938536e79b57882ef1) Author [@amircheikh](https://github.com/amircheikh) - Synced API as per mono v2025.10.2

## 0.6.1

### Patch Changes

- [#993](https://github.com/tkhq/sdk/pull/993) [`68631c4`](https://github.com/tkhq/sdk/commit/68631c4008387f845dfe4f1a139981011727f6c9) Author [@moeodeh3](https://github.com/moeodeh3) - Added a new error code `WALLET_BUILD_LOGIN_REQUEST_ERROR` in `TurnkeyErrorCodes`

## 0.6.0

### Minor Changes

- [#974](https://github.com/tkhq/sdk/pull/974) [`3997c0f`](https://github.com/tkhq/sdk/commit/3997c0fd08a8a85108acf904c0bf39d69f8dc79c) Author [@narimonf](https://github.com/narimonf) - Added FETCH_BOOT_PROOF_ERROR type.

## 0.5.0

### Minor Changes

- [#977](https://github.com/tkhq/sdk/pull/977) [`4567059`](https://github.com/tkhq/sdk/commit/45670598f102223925b87a5295edca15a6ce8241) Author [@besler613](https://github.com/besler613) - OAuth2Authenticate now supports returning the encrypted bearer token via the optional `bearerTokenTargetPublicKey` request parameter (mono release v2025.9.5)

## 0.4.1

### Patch Changes

- [#958](https://github.com/tkhq/sdk/pull/958) [`5a96fe8`](https://github.com/tkhq/sdk/commit/5a96fe80db4c4c45e09ad8c613695ee4c2b8e51f) Author [@amircheikh](https://github.com/amircheikh) - - Synced api with mono

## 0.4.0

## 0.4.0-beta.6

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta release

## 0.4.0-beta.5

### Minor Changes

- SDK beta release @turnkey/react-wallet-kit @turnkey/core

## 0.4.0-beta.4

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta-3 release

## 0.4.0-beta.3

### Minor Changes

- @turnkey/react-wallet-kit and @turnkey/core beta-3 release

## 0.4.0-beta.2

### Minor Changes

- updating package versions

## 0.4.0-beta.1

### Minor Changes

- test build

## 0.4.0-beta.0

### Minor Changes

- beta for @turnkey/react-wallet-kit and @turnkey/core

## 0.3.0

### Minor Changes

- [#651](https://github.com/tkhq/sdk/pull/651) [`81e355c`](https://github.com/tkhq/sdk/commit/81e355c9a8321feffcac056916b65139cf35eeed) Author [@turnekybc](https://github.com/turnekybc) - Add Coinbase & MoonPay Fiat Onramp. View the [Fiat Onramp feature docs](https://docs.turnkey.com/wallets/fiat-on-ramp).

## 0.2.1

### Patch Changes

- [#693](https://github.com/tkhq/sdk/pull/693) [`039602a`](https://github.com/tkhq/sdk/commit/039602a015d20783952b992d1d339f5fc003f658) Author [@turnekybc](https://github.com/turnekybc) - Add FiatOnRampCryptoCurrency Enum

## 0.2.0

### Minor Changes

- [#686](https://github.com/tkhq/sdk/pull/686) [`0dd3fc3`](https://github.com/tkhq/sdk/commit/0dd3fc31956992c5b449da5868f6eef8b0bb194c) Author [@turnekybc](https://github.com/turnekybc) - Add FiatOnRampProvider Type

## 0.1.0

### Minor Changes

- Update @turnkey/sdk-types readme and install dependency in packages with common types

- [#650](https://github.com/tkhq/sdk/pull/650) [`27fe590`](https://github.com/tkhq/sdk/commit/27fe590cdc3eb6a8cde093eeefda2ee1cdc79412) Author [@turnekybc](https://github.com/turnekybc) - Update @turnkey/sdk-types readme and install dependency in packages with common types

## 0.0.2

### Patch Changes

- [#589](https://github.com/tkhq/sdk/pull/589) [`d579553`](https://github.com/tkhq/sdk/commit/d579553006eba29947dee6b45c3ce2025695732f) Author [@turnekybc](https://github.com/turnekybc) - Publish @turnkey/sdk-types package
