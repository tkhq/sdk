# @turnkey/react-native-wallet-kit

## 2.0.1

### Patch Changes

- Updated dependencies [[`bf2c28f`](https://github.com/tkhq/sdk/commit/bf2c28fec690ec31254125405bf15a482139109b), [`f505818`](https://github.com/tkhq/sdk/commit/f505818e121c137d290156a32918a884ba80e5f5), [`3adc0c9`](https://github.com/tkhq/sdk/commit/3adc0c96cf524b59584e5f5688f7830fc79ebeb4), [`ad044cd`](https://github.com/tkhq/sdk/commit/ad044cdcd41690c6479a81c56ebcd6d5108581fb)]:
  - @turnkey/sdk-types@1.1.0
  - @turnkey/core@2.1.0
  - @turnkey/crypto@2.10.0
  - @turnkey/react-native-passkey-stamper@1.2.15

## 2.0.0

### Major Changes

- [#1250](https://github.com/tkhq/sdk/pull/1250) [`63a8e9b`](https://github.com/tkhq/sdk/commit/63a8e9b9505671ed76bee1658053a8af72408efd) Author [@moeodeh3](https://github.com/moeodeh3) - ### Secondary client IDs

  **What changed:** Each OAuth provider in `TurnkeyProviderConfig.auth.oauth` is now configured via a per-provider type with `primaryClientId` and `secondaryClientIds` fields. Every `handle*Oauth` function accepts the same `primaryClientId` / `secondaryClientIds` overrides on a per-call basis.

  `secondaryClientIds` are additional client IDs that get linked to the user during sign-up: they're decoded into `oidcClaims` (`{ iss, sub, aud }`) sharing the same identity as the primary OIDC token and registered as additional audiences during sub-organization creation. This lets a user who signed in with one client ID on one platform sign in with a different client ID on another platform and resolve to the same sub-organization. Existing users can call `addOauthProvider` with `oidcClaims` to retroactively link new audiences.

  ```ts
  // before
  <TurnkeyProvider
    config={{
      auth: {
        oauth: {
          google: { clientId: "<google-client-id>" },
          apple: { clientId: "<apple-services-id>" },
        },
      },
    }}
  />;

  // after
  <TurnkeyProvider
    config={{
      auth: {
        oauth: {
          google: {
            // Google's primaryClientId is an object with a webClientId field.
            primaryClientId: {
              webClientId: "<google-client-id>",
            },
            secondaryClientIds: ["<google-client-id-2>"],
          },
          apple: {
            // Apple's primaryClientId is an object with the iOS bundle ID and
            // web/Android Services ID. See the new handleAppleOauth section below.
            primaryClientId: {
              iosBundleId: "<your-app-bundle-id>",
              serviceId: "<apple-services-id>",
            },
            secondaryClientIds: ["<another-services-id>"],
          },
        },
      },
    }}
  />;
  ```

  ***

  ### `handle*Oauth` params

  **What changed:** Renamed `clientId` → `primaryClientId` and added `secondaryClientIds` to every `handle*Oauth` function (`handleGoogleOauth`, `handleAppleOauth`, `handleFacebookOauth`, `handleXOauth`, `handleDiscordOauth`). Per-call overrides take precedence over the values from `TurnkeyProviderConfig`.

  ```ts
  // before
  await handleGoogleOauth({ clientId: "<google-client-id>" });

  // after
  await handleGoogleOauth({
    primaryClientId: {
      webClientId: "<google-client-id>",
    },
    secondaryClientIds: ["<google-client-id-2>"],
  });
  ```

  ***

  ### Google OAuth: `handleGoogleOauth`

  **What changed:** Google's `primaryClientId` is an object `{ webClientId }` instead of a plain string. This allows the Google config to be extended with additional platform-specific client IDs in the future.

  ```ts
  // per-call override
  await handleGoogleOauth({
    primaryClientId: {
      webClientId: "<google-client-id>",
    },
    secondaryClientIds: ["<google-client-id-2>"],
  });
  ```

  ***

  ### Native Apple Sign-In: `handleAppleOauth`

  **What changed:** `handleAppleOauth` now uses native Apple Sign-In on iOS (via `@invertase/react-native-apple-authentication`) and a web-based fallback on Android. Apple's `primaryClientId` is now an object: `{ iosBundleId, serviceId }`.
  - On iOS, the native flow uses `iosBundleId` as the audience and links `serviceId` as a secondary audience during sub-organization creation.
  - On Android, the web flow uses `serviceId` as the audience and links `iosBundleId` as a secondary audience.
  - Any `secondaryClientIds` are linked alongside as additional audiences on both platforms.

  ```ts
  // triggers native Apple sign-in on iOS, web flow on Android
  await handleAppleOauth();

  // per-call override
  await handleAppleOauth({
    primaryClientId: {
      iosBundleId: "<your-app-bundle-id>",
      serviceId: "<apple-services-id>",
    },
    secondaryClientIds: ["<another-services-id>"],
  });
  ```

  ***

  ### `handleAppleWebOauth` (deprecated)

  **What changed:** The previous web-based Apple OAuth flow is preserved as `handleAppleWebOauth` for backwards compatibility. It opens the in-app browser to Apple's web OAuth flow on all platforms using `primaryClientId.serviceId` as the audience and ignores `iosBundleId`. New integrations should use `handleAppleOauth` instead.

  ```ts
  // deprecated — kept for backwards compatibility with previous versions
  await handleAppleWebOauth();
  ```

- [#1250](https://github.com/tkhq/sdk/pull/1250) [`654fadc`](https://github.com/tkhq/sdk/commit/654fadc7b8296b7af7e5a68dee9ee6de20eef4c1) Author [@moeodeh3](https://github.com/moeodeh3) - ### `initOtp`

  **What changed:** Now returns an `InitOtpResult` object instead of a plain `otpId` string.

  ```ts
  // before
  const otpId: string = await initOtp({
    otpType: OtpType.Email,
    contact: "user@example.com",
  });

  // after
  const { otpId, otpEncryptionTargetBundle }: InitOtpResult = await initOtp({
    otpType: OtpType.Email,
    contact: "user@example.com",
  });
  ```

  ***

  ### `verifyOtp`

  **What changed:** Removed `contact` and `otpType` params. Added required `otpEncryptionTargetBundle`. The account lookup (`proxyGetAccount`) that previously happened inside `verifyOtp` has been moved out, so `verifyOtp` is now purely verification. Returns `verificationToken` and `publicKey` (removed `subOrganizationId`).

  ```ts
  // before — verifyOtp also fetched the subOrganizationId internally
  const { subOrganizationId, verificationToken } = await verifyOtp({
    otpId,
    otpCode,
    contact: "user@example.com",
    otpType: OtpType.Email,
  });

  // after — verification only; account lookup is separate
  const { verificationToken, publicKey } = await verifyOtp({
    otpId,
    otpCode,
    otpEncryptionTargetBundle, // new — from initOtp
    publicKey,
  });

  // account lookup is now done separately (e.g. inside completeOtp)
  const { organizationId: subOrgId } = await httpClient.proxyGetAccount({
    filterType: OtpTypeToFilterTypeMap[otpType],
    filterValue: contact,
    verificationToken,
  });
  ```

  ***

  ### `loginWithOtp`

  **What changed:** Removed `publicKey` param. The key bound during `verifyOtp` is now automatically reused as the session public key and used to produce the required `clientSignature`.

  ```ts
  // before
  await loginWithOtp({
    verificationToken,
    publicKey,
    invalidateExisting: true,
  });

  // after
  await loginWithOtp({
    verificationToken,
    invalidateExisting: true,
  });
  ```

  ***

  ### `signUpWithOtp`

  **What changed:** Removed `publicKey` param. The key bound during `verifyOtp` is now automatically reused as the session public key and used to produce the required `clientSignature`.

  ```ts
  // before
  await signUpWithOtp({
    verificationToken,
    contact: "user@example.com",
    otpType: OtpType.Email,
    publicKey,
  });

  // after
  await signUpWithOtp({
    verificationToken,
    contact: "user@example.com",
    otpType: OtpType.Email,
  });
  ```

- [#1250](https://github.com/tkhq/sdk/pull/1250) [`63a8e9b`](https://github.com/tkhq/sdk/commit/63a8e9b9505671ed76bee1658053a8af72408efd) Author [@moeodeh3](https://github.com/moeodeh3) - `signUpWithPasskey` now no longer accepts an `organizationId`. This value is now taken exclusively from the config.

  The `sendSignedRequest` helper function has been removed. This is replaced with `httpClient.sendSignedRequest`.

- [#1280](https://github.com/tkhq/sdk/pull/1280) [`acc33d8`](https://github.com/tkhq/sdk/commit/acc33d879b826fbf63473635f9bd160da1f39c39) Author [@hadrelandon](https://github.com/hadrelandon) - Removed `additionalState` from React Native OAuth, it is no longer needed for React Native OAuth flows.

### Minor Changes

- [#1286](https://github.com/tkhq/sdk/pull/1286) [`7a36539`](https://github.com/tkhq/sdk/commit/7a36539196856a8bd4ca4c54115fa9874ccc83fa) Author [@moeodeh3](https://github.com/moeodeh3) - - Added `overrideApiKeyStamper` and `overridePasskeyStamper` methods to allow updating the stamper configurations during runtime
  - Added `deleteApiKeyPair` method for cleaning up key pairs that aren't associated with active sessions

- [#1290](https://github.com/tkhq/sdk/pull/1290) [`2b65654`](https://github.com/tkhq/sdk/commit/2b6565453028639441d4dc72fc1f5897c9213e87) Author [@hadrelandon](https://github.com/hadrelandon) - Added `auth.scopePasskeyToUser` to control passkey scoping on the provider config.

- [#1250](https://github.com/tkhq/sdk/pull/1250) [`1901eb8`](https://github.com/tkhq/sdk/commit/1901eb88b24cc68256f71789bfbed139aba91bb4) Author [@moeodeh3](https://github.com/moeodeh3) - Added `signWithApiKey()` which allows users to sign arbitrary messages using the API key stamper.

  `addOauthProvider` now accepts a list of `oidcClaims` and the `oidcToken` parameter is now optional. This means the function can now be called with either an `oidcToken`, a list of `oidcClaims` or both.

  An `oidcClaims` entry is the `{ iss, sub, aud }` triple from an OIDC token - `iss` and `sub` identify the user and `aud` is the client ID the token was issued for. Passing them lets you register additional audiences (e.g. iOS bundle ID + web client ID) against the same identity without needing a separate token for each, so a single user can sign in from any of them and resolve to the same sub-organization.

### Patch Changes

- [#1280](https://github.com/tkhq/sdk/pull/1280) [`acc33d8`](https://github.com/tkhq/sdk/commit/acc33d879b826fbf63473635f9bd160da1f39c39) Author [@hadrelandon](https://github.com/hadrelandon) - Fixed OAuth state validation to reject missing, tampered, and mismatched state parameters, and to always clean up stored state after validation attempts.

- [#1286](https://github.com/tkhq/sdk/pull/1286) [`763761d`](https://github.com/tkhq/sdk/commit/763761df369841154253c3a51291ffeca61c811d) Author [@moeodeh3](https://github.com/moeodeh3) - Scope passkey `allowCredentials` to the authenticated user's credentials after login. `refreshUser` now returns `v1User | undefined`.

- Updated dependencies [[`7a36539`](https://github.com/tkhq/sdk/commit/7a36539196856a8bd4ca4c54115fa9874ccc83fa), [`11b1717`](https://github.com/tkhq/sdk/commit/11b1717896e27d2fbfc5efc73af5e29c4cf0258b), [`ec0e99a`](https://github.com/tkhq/sdk/commit/ec0e99af3c0a523505c12b8e44efedca539e2399), [`d677115`](https://github.com/tkhq/sdk/commit/d677115e60aaee53319131723541211457803317), [`34522d4`](https://github.com/tkhq/sdk/commit/34522d447592138a82d34cd690091315f9748edb), [`7a36539`](https://github.com/tkhq/sdk/commit/7a36539196856a8bd4ca4c54115fa9874ccc83fa), [`1901eb8`](https://github.com/tkhq/sdk/commit/1901eb88b24cc68256f71789bfbed139aba91bb4), [`63a8e9b`](https://github.com/tkhq/sdk/commit/63a8e9b9505671ed76bee1658053a8af72408efd), [`47c0ca4`](https://github.com/tkhq/sdk/commit/47c0ca4696c8a518f95550c35cfe4cb4985a2633), [`5624d54`](https://github.com/tkhq/sdk/commit/5624d5417d2cc30032ca4ce71da0a5c7ab9a462d), [`6128132`](https://github.com/tkhq/sdk/commit/6128132d910f658cdf83ecc1dec6598eb20c008a), [`7b80b1e`](https://github.com/tkhq/sdk/commit/7b80b1e9755b83988b5e49c34dff13dd92d9932f)]:
  - @turnkey/core@2.0.0
  - @turnkey/crypto@2.9.0
  - @turnkey/sdk-types@1.0.0
  - @turnkey/react-native-passkey-stamper@1.2.14

## 1.5.2

### Patch Changes

- [#1257](https://github.com/tkhq/sdk/pull/1257) [`aa3e55e`](https://github.com/tkhq/sdk/commit/aa3e55e1e5adea1945647c84fe247bc2761a8f77) Thanks [@Bijan-Massoumi](https://github.com/Bijan-Massoumi)! - Add full status response as `error.cause` on errors thrown by `pollTransactionStatus()`

- Updated dependencies [[`ef66673`](https://github.com/tkhq/sdk/commit/ef6667325d210c8aa0ea4c1d11d834ff28ddb66c), [`aa3e55e`](https://github.com/tkhq/sdk/commit/aa3e55e1e5adea1945647c84fe247bc2761a8f77), [`8209887`](https://github.com/tkhq/sdk/commit/8209887d48bae7ea617645603a156aeb1cfbd2e7), [`59ebe9b`](https://github.com/tkhq/sdk/commit/59ebe9bc4a5fa3c015ed32cc6b8ab0b66523b0a4)]:
  - @turnkey/sdk-types@0.14.0
  - @turnkey/core@1.14.1
  - @turnkey/crypto@2.8.14
  - @turnkey/react-native-passkey-stamper@1.2.13

## 1.5.1

### Patch Changes

- Updated dependencies [[`068abcb`](https://github.com/tkhq/sdk/commit/068abcb11e05972329034222bed52865f405f1c4)]:
  - @turnkey/sdk-types@0.13.0
  - @turnkey/core@1.14.0
  - @turnkey/react-native-passkey-stamper@1.2.12
  - @turnkey/crypto@2.8.13

## 1.5.0

### Minor Changes

- [#1228](https://github.com/tkhq/sdk/pull/1228) [`1d108d6`](https://github.com/tkhq/sdk/commit/1d108d6496ad8266db0e997a27aecc81e46008fb) Thanks [@moe-dev](https://github.com/moe-dev)! - This branch adds first-class ERC20 transfer abstractions across `@turnkey/core`, `@turnkey/react-wallet-kit`, and `@turnkey/react-native-wallet-kit`.

  ### `@turnkey/core`
  - Added `Erc20Transfer` and `EthSendErc20TransferParams` method types.
  - Added `TurnkeyClient.ethSendErc20Transfer(...)` as a convenience wrapper that ABI-encodes `transfer(address,uint256)` and submits via `ethSendTransaction`.
  - Updated `ethSendTransaction` to stop prefetching nonces with `getNonces`; transaction fields are now forwarded directly to Turnkey's coordinator (including optional caller-provided `nonce` / `gasStationNonce`).

  ### `@turnkey/react-wallet-kit`
  - Added low-level `ethSendErc20Transfer(...)` passthrough in the client provider context.
  - Added `handleSendErc20Transfer(...)` modal flow that submits ERC20 transfers and polls transaction status to terminal state.
  - Added new public types/docs for `HandleSendErc20TransferParams` and `ClientContextType.handleSendErc20Transfer`.

  ### `@turnkey/react-native-wallet-kit`
  - Added low-level `ethSendErc20Transfer(...)` passthrough in `TurnkeyProvider` context to match `ClientContextType` and support ERC20 sends from React Native.

### Patch Changes

- Updated dependencies [[`82dc76c`](https://github.com/tkhq/sdk/commit/82dc76c7ce51e5375570bbffab32eb739af90381), [`1d108d6`](https://github.com/tkhq/sdk/commit/1d108d6496ad8266db0e997a27aecc81e46008fb), [`dfdd864`](https://github.com/tkhq/sdk/commit/dfdd8647266fdd0297aaea32046ee815ae8fc27c)]:
  - @turnkey/core@1.13.0
  - @turnkey/sdk-types@0.12.1
  - @turnkey/crypto@2.8.12
  - @turnkey/react-native-passkey-stamper@1.2.11

## 1.4.2

### Patch Changes

- Updated dependencies [[`af6262f`](https://github.com/tkhq/sdk/commit/af6262f31e1abb3090fcda1eec5318056e6d51fe), [`1f6e240`](https://github.com/tkhq/sdk/commit/1f6e2403fca1fd9cbca646f88c88dbc49ddb0c34), [`58e04e5`](https://github.com/tkhq/sdk/commit/58e04e5856626d9d2593abb61d8ca32d8ccbb833), [`7458b7c`](https://github.com/tkhq/sdk/commit/7458b7cd6fc64796b376e3374b7c2ed79467459c)]:
  - @turnkey/core@1.12.0
  - @turnkey/sdk-types@0.12.0
  - @turnkey/crypto@2.8.11
  - @turnkey/react-native-passkey-stamper@1.2.10

## 1.4.1

### Patch Changes

- Updated dependencies [[`d49ef7e`](https://github.com/tkhq/sdk/commit/d49ef7e9f0f78f16b1324a357f61cf0351198096), [`dced9db`](https://github.com/tkhq/sdk/commit/dced9dbbd8ea533442e19e45ce36e6a05a45a555)]:
  - @turnkey/core@1.11.2
  - @turnkey/react-native-passkey-stamper@1.2.9

## 1.4.0

### Minor Changes

- [#1181](https://github.com/tkhq/sdk/pull/1181) [`c043e41`](https://github.com/tkhq/sdk/commit/c043e412fbc6369c881192cdd50251b210d7a552) Author [@amircheikh](https://github.com/amircheikh) - Twitter oAuth credentials created from `handleXOauth` or `handleAddOauthProvider` will now be stored with the `providerName` `"x"` in the user's `oauthProviders` list. This only affects new credentials.

### Patch Changes

- Updated dependencies [[`8e075b7`](https://github.com/tkhq/sdk/commit/8e075b7161ccc68cb446b10b54737856fa0c6d31), [`2d19991`](https://github.com/tkhq/sdk/commit/2d19991bcf4e1c9704b73a48c54e870373b4bd95), [`89d4084`](https://github.com/tkhq/sdk/commit/89d40844d791b0bbb6d439da5e778b1fdeca4273), [`ba2521d`](https://github.com/tkhq/sdk/commit/ba2521d5d1c1f6baaa58ee65dce8cc4839f7dc7b), [`12ca083`](https://github.com/tkhq/sdk/commit/12ca083314310b05cf41ac29fa2d55eed627f229), [`a85153c`](https://github.com/tkhq/sdk/commit/a85153c8ccc7454cd5aca974bc463fb47c7f8cd4)]:
  - @turnkey/sdk-types@0.11.2
  - @turnkey/core@1.11.1
  - @turnkey/crypto@2.8.10
  - @turnkey/react-native-passkey-stamper@1.2.8

## 1.3.2

### Patch Changes

- Updated dependencies [[`91d6a9e`](https://github.com/tkhq/sdk/commit/91d6a9eb1b9ac9e21745749615ac7a7be66f5cf6), [`d0dba04`](https://github.com/tkhq/sdk/commit/d0dba0412fa7b0c7c9b135e73cc0ef6f55187314), [`699fbd7`](https://github.com/tkhq/sdk/commit/699fbd75ef3f44f768ae641ab4f652e966b8e289), [`91d6a9e`](https://github.com/tkhq/sdk/commit/91d6a9eb1b9ac9e21745749615ac7a7be66f5cf6)]:
  - @turnkey/core@1.11.0
  - @turnkey/crypto@2.8.9
  - @turnkey/sdk-types@0.11.1
  - @turnkey/react-native-passkey-stamper@1.2.7

## 1.3.1

### Patch Changes

- Updated dependencies [[`6261eed`](https://github.com/tkhq/sdk/commit/6261eed95af8627bf1e95e7291b9760a2267e301), [`78ec1d9`](https://github.com/tkhq/sdk/commit/78ec1d9afcafde3ca7107fc720323d486d6afaea)]:
  - @turnkey/core@1.10.0
  - @turnkey/sdk-types@0.11.0
  - @turnkey/crypto@2.8.8
  - @turnkey/react-native-passkey-stamper@1.2.6

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
