# @turnkey/sdk-types

## 1.1.0

### Minor Changes

- [#1324](https://github.com/tkhq/sdk/pull/1324) [`f505818`](https://github.com/tkhq/sdk/commit/f505818e121c137d290156a32918a884ba80e5f5) Author [@janjakubnanista](https://github.com/janjakubnanista) - ### Breaking/Behavioral Changes

  #### `nonce` parameter in `oauth2Authenticate` is now required

  ```ts
  # Before
  apiClient.oauth2Authenticate({
    oauth2CredentialId: ...,
    authCode: ...,
    redirectUri: ...,
    codeVerifier: ...,
    bearerTokenTargetPublicKey: ...,
    // nonce can be undefined
    nonce: undefined
  })

  # After
  apiClient.oauth2Authenticate({
    oauth2CredentialId: ...,
    authCode: ...,
    redirectUri: ...,
    codeVerifier: ...,
    bearerTokenTargetPublicKey: ...,
    // nonce is required
    nonce: ""
  })
  ```

  #### Solana transactions in Transaction Management are now limited to the following `caip2` values:
  - `solana:mainnet`
  - `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
  - `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`
  - `solana:devnet`
  - `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
  - `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`

  ### New SDK methods

  #### TVC

  These methods will only work if you are part of the [TVC beta](https://www.turnkey.com/turnkey-verifiable-cloud#waitlist)
  - `getTvcApp`
  - `getTvcDeployment`
  - `getTvcAppDeployments`
  - `getTvcApps`
  - `validateTvcImage`
  - `createTvcApp`
  - `createTvcDeployment`
  - `createTvcManifestApprovals`
  - `deleteTvcAppAndDeployments`
  - `deleteTvcDeployment`
  - `restoreTvcDeployment`
  - `updateTvcAppLiveDeployment`

  #### Spark protocol support
  - `sparkClaimTransfer`
  - `sparkPrepareLightningReceive`
  - `sparkPrepareTransfer`
  - `sparkSignFrost`

### Patch Changes

- [#1299](https://github.com/tkhq/sdk/pull/1299) [`bf2c28f`](https://github.com/tkhq/sdk/commit/bf2c28fec690ec31254125405bf15a482139109b) Author [@ethankonk](https://github.com/ethankonk) - Patched the core sdk's client to allow passing in the `generateAppProofs` param to all activity requests

## 1.0.0

### Major Changes

- [#1250](https://github.com/tkhq/sdk/pull/1250) [`6128132`](https://github.com/tkhq/sdk/commit/6128132d910f658cdf83ecc1dec6598eb20c008a) Author [@moeodeh3](https://github.com/moeodeh3) - ### `INIT_OTP`

  `ACTIVITY_TYPE_INIT_OTP_V2` → `ACTIVITY_TYPE_INIT_OTP_V3`

  **What changed:** Added required `otpEncryptionTargetBundle` to the result.

  ```ts
  // before — v1InitOtpResult
  {
    otpId: string;
  }

  // after — v1InitOtpResultV2
  {
    otpId: string;
    otpEncryptionTargetBundle: string; // new
  }
  ```

  ***

  ### `VERIFY_OTP`

  `ACTIVITY_TYPE_VERIFY_OTP` → `ACTIVITY_TYPE_VERIFY_OTP_V2`

  **What changed:** Replaced plaintext `otpCode` + `publicKey` with a single `encryptedOtpBundle`.

  Instead of sending the OTP code in plaintext, you now HPKE-encrypt it (along with your public key) to Turnkey's enclave using the `otpEncryptionTargetBundle` returned by `initOtp`. This ensures the OTP code never leaves the client in plaintext.

  Use `encryptOtpCodeToBundle` from `@turnkey/crypto` to build the bundle:

  ```ts
  import { encryptOtpCodeToBundle } from "@turnkey/crypto";

  const { otpId, otpEncryptionTargetBundle } = await client.initOtp({ ... });

  // After the user enters their OTP code:
  const encryptedOtpBundle = await encryptOtpCodeToBundle(
    otpCode,                    // the code the user entered
    otpEncryptionTargetBundle,  // from the initOtp response
    publicKey,                  // your target public key
  );

  await client.verifyOtp({
    otpId,
    encryptedOtpBundle,
  });
  ```

  ```ts
  // before — v1VerifyOtpIntent
  {
    otpId: string;
    otpCode: string;           // removed
    expirationSeconds?: string;
    publicKey?: string;         // removed
  }

  // after — v1VerifyOtpIntentV2
  {
    otpId: string;
    encryptedOtpBundle: string; // new — replaces otpCode + publicKey
    expirationSeconds?: string;
  }
  ```

  ***

  ### `OTP_LOGIN`

  `ACTIVITY_TYPE_OTP_LOGIN` → `ACTIVITY_TYPE_OTP_LOGIN_V2`

  **What changed:** `clientSignature` promoted from optional to required.

  ```ts
  // before — v1OtpLoginIntent
  {
    verificationToken: string;
    publicKey: string;
    expirationSeconds?: string;
    invalidateExisting?: boolean;
    clientSignature?: v1ClientSignature; // optional
  }

  // after — v1OtpLoginIntentV2
  {
    verificationToken: string;
    publicKey: string;
    expirationSeconds?: string;
    invalidateExisting?: boolean;
    clientSignature: v1ClientSignature;  // now required
  }
  ```

  ***

  ### `CREATE_OAUTH_PROVIDERS`

  `ACTIVITY_TYPE_CREATE_OAUTH_PROVIDERS` → `ACTIVITY_TYPE_CREATE_OAUTH_PROVIDERS_V2`

  **What changed:** Added `oidcClaims` as a new option alongside `oidcToken`; you must provide exactly one. This updated type feeds into the `CREATE_SUB_ORGANIZATION` and `CREATE_USERS` changes below.

  ```ts
  // before — v1OauthProviderParams
  {
    providerName: string;
    oidcToken: string;
  }

  // after — v1OauthProviderParamsV2
  {
    providerName: string;
  } & (
    | { oidcToken: string }
    | { oidcClaims: { iss: string; sub: string; aud: string } }
  )
  ```

  ***

  ### `CREATE_SUB_ORGANIZATION`

  `ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7` → `ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V8`

  **What changed:** `rootUsers` items updated from `v1RootUserParamsV4` → `v1RootUserParamsV5`, which updates `oauthProviders` from `v1OauthProviderParams` → `v1OauthProviderParamsV2`.

  ```ts
  // before — v1RootUserParamsV4
  {
    userName: string;
    userEmail?: string;
    userPhoneNumber?: string;
    apiKeys: v1ApiKeyParamsV2[];
    authenticators: v1AuthenticatorParamsV2[];
    oauthProviders: {              // v1OauthProviderParams
      providerName: string;
      oidcToken: string;           // was required
    }[];
  }

  // after — v1RootUserParamsV5
  {
    userName: string;
    userEmail?: string;
    userPhoneNumber?: string;
    apiKeys: v1ApiKeyParamsV2[];
    authenticators: v1AuthenticatorParamsV2[];
    oauthProviders: ({             // v1OauthProviderParamsV2
      providerName: string;
    } & (
      | { oidcToken: string }
      | { oidcClaims: { iss: string; sub: string; aud: string } }
    ))[];
  }
  ```

  ***

  ### `CREATE_USERS`

  `ACTIVITY_TYPE_CREATE_USERS_V3` → `ACTIVITY_TYPE_CREATE_USERS_V4`

  **What changed:** `users` items updated from `v1UserParamsV3` → `v1UserParamsV4`, which updates `oauthProviders` from `v1OauthProviderParams` → `v1OauthProviderParamsV2`.

  ```ts
  // before — v1UserParamsV3
  {
    userName: string;
    userEmail?: string;
    userPhoneNumber?: string;
    apiKeys: v1ApiKeyParamsV2[];
    authenticators: v1AuthenticatorParamsV2[];
    oauthProviders: {              // v1OauthProviderParams
      providerName: string;
      oidcToken: string;           // was required
    }[];
    userTags: string[];
  }

  // after — v1UserParamsV4
  {
    userName: string;
    userEmail?: string;
    userPhoneNumber?: string;
    apiKeys: v1ApiKeyParamsV2[];
    authenticators: v1AuthenticatorParamsV2[];
    oauthProviders: ({             // v1OauthProviderParamsV2
      providerName: string;
    } & (
      | { oidcToken: string }
      | { oidcClaims: { iss: string; sub: string; aud: string } }
    ))[];
    userTags: string[];
  }
  ```

### Minor Changes

- [#1250](https://github.com/tkhq/sdk/pull/1250) [`34522d4`](https://github.com/tkhq/sdk/commit/34522d447592138a82d34cd690091315f9748edb) Author [@moeodeh3](https://github.com/moeodeh3) - Add `SignatureFormat` enum with `Der` and `Raw` options

- [#1286](https://github.com/tkhq/sdk/pull/1286) [`7a36539`](https://github.com/tkhq/sdk/commit/7a36539196856a8bd4ca4c54115fa9874ccc83fa) Author [@moeodeh3](https://github.com/moeodeh3) - Add `DELETE_API_KEY_PAIR_ERROR` to `TurnkeyErrorCodes`
  Add `INITIALIZE_API_KEY_STAMPER_ERROR` to `TurnkeyErrorCodes`
  Add `INITIALIZE_PASSKEY_STAMPER_ERROR` to `TurnkeyErrorCodes`
  Add `INITIALIZE_WALLET_MANAGER_ERROR` to `TurnkeyErrorCodes`

- [#1225](https://github.com/tkhq/sdk/pull/1225) [`5624d54`](https://github.com/tkhq/sdk/commit/5624d5417d2cc30032ca4ce71da0a5c7ab9a462d) Author [@ethankonk](https://github.com/ethankonk) - Fixed nested enums in types, now generates the enum values rather than generating them as strings

- [#1280](https://github.com/tkhq/sdk/pull/1280) [`7b80b1e`](https://github.com/tkhq/sdk/commit/7b80b1e9755b83988b5e49c34dff13dd92d9932f) Author [@hadrelandon](https://github.com/hadrelandon) - Added a new error code `INVALID_OAUTH_STATE` in `TurnkeyErrorCodes`.

### Patch Changes

- [#1225](https://github.com/tkhq/sdk/pull/1225) [`47c0ca4`](https://github.com/tkhq/sdk/commit/47c0ca4696c8a518f95550c35cfe4cb4985a2633) Author [@ethankonk](https://github.com/ethankonk) - Added `Stamp`, `Activity` response + status, `TurnkeyRequestError`, and `GrpcStatus` types

## 0.14.0

### Minor Changes

- [#1258](https://github.com/tkhq/sdk/pull/1258) [`8209887`](https://github.com/tkhq/sdk/commit/8209887d48bae7ea617645603a156aeb1cfbd2e7) Author [@moeodeh3](https://github.com/moeodeh3) - Added a new error code `NO_PKCE_VERIFIER_FOUND` in `TurnkeyErrorCodes`

### Patch Changes

- [#1269](https://github.com/tkhq/sdk/pull/1269) [`ef66673`](https://github.com/tkhq/sdk/commit/ef6667325d210c8aa0ea4c1d11d834ff28ddb66c) Author [@ethankonk](https://github.com/ethankonk) - Sync with v2026.4.5 of mono

## 0.13.0

### Minor Changes

- [#1244](https://github.com/tkhq/sdk/pull/1244) [`068abcb`](https://github.com/tkhq/sdk/commit/068abcb11e05972329034222bed52865f405f1c4) Thanks [@moe-dev](https://github.com/moe-dev)! - Sync as per mono v2026.3.6

## 0.12.1

### Patch Changes

- [#1241](https://github.com/tkhq/sdk/pull/1241) [`dfdd864`](https://github.com/tkhq/sdk/commit/dfdd8647266fdd0297aaea32046ee815ae8fc27c) Author [@ethankonk](https://github.com/ethankonk) - Patched solana chain filter in wallet connecting logic

## 0.12.0

### Minor Changes

- [#1206](https://github.com/tkhq/sdk/pull/1206) [`58e04e5`](https://github.com/tkhq/sdk/commit/58e04e5856626d9d2593abb61d8ca32d8ccbb833) Author [@DeRauk](https://github.com/DeRauk) - Adds sdk methods for the GetWalletAddressBalances and ListSupportedAssets apis.

### Patch Changes

- [#1201](https://github.com/tkhq/sdk/pull/1201) [`1f6e240`](https://github.com/tkhq/sdk/commit/1f6e2403fca1fd9cbca646f88c88dbc49ddb0c34) Author [@ethankonk](https://github.com/ethankonk) - Synced with Mono v2026.2.0

- [#1197](https://github.com/tkhq/sdk/pull/1197) [`7458b7c`](https://github.com/tkhq/sdk/commit/7458b7cd6fc64796b376e3374b7c2ed79467459c) Thanks [@moe-dev](https://github.com/moe-dev)! - Add support for SolSendTransaction and associated abstractions

## 0.11.2

### Patch Changes

- [#1180](https://github.com/tkhq/sdk/pull/1180) [`8e075b7`](https://github.com/tkhq/sdk/commit/8e075b7161ccc68cb446b10b54737856fa0c6d31) Author [@amircheikh](https://github.com/amircheikh) - `OAuthProviders` enum now maps all provider names to fully lowercase strings.

## 0.11.1

### Patch Changes

- [#1135](https://github.com/tkhq/sdk/pull/1135) [`91d6a9e`](https://github.com/tkhq/sdk/commit/91d6a9eb1b9ac9e21745749615ac7a7be66f5cf6) Author [@ethankonk](https://github.com/ethankonk) - - Synced with `mono` v2025.12.2

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
