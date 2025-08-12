# @turnkey/sdk-browser

## 5.8.0

### Minor Changes

- [#861](https://github.com/tkhq/sdk/pull/861) [`5d8be2d`](https://github.com/tkhq/sdk/commit/5d8be2d0329070c7aa025dddb1b28f04257ae4e6) Author [@amircheikh](https://github.com/amircheikh) - Synced as per mono 2025.8.4

### Patch Changes

- Updated dependencies [[`5d8be2d`](https://github.com/tkhq/sdk/commit/5d8be2d0329070c7aa025dddb1b28f04257ae4e6)]:
  - @turnkey/http@3.10.0
  - @turnkey/crypto@2.5.0
  - @turnkey/wallet-stamper@1.0.8

## 5.7.0

### Minor Changes

- [#834](https://github.com/tkhq/sdk/pull/834) [`8b39dba`](https://github.com/tkhq/sdk/commit/8b39dbabf68d3e376b5b07f26960d5b61ae87fa9) Author [@moeodeh3](https://github.com/moeodeh3) - Update per mono release v2025.8.3-hotfix.0

### Patch Changes

- Updated dependencies [[`8b39dba`](https://github.com/tkhq/sdk/commit/8b39dbabf68d3e376b5b07f26960d5b61ae87fa9)]:
  - @turnkey/http@3.9.0
  - @turnkey/crypto@2.5.0
  - @turnkey/wallet-stamper@1.0.8

## 5.6.0

### Minor Changes

- [#826](https://github.com/tkhq/sdk/pull/826) [`f83f25b`](https://github.com/tkhq/sdk/commit/f83f25ba33ef15dbd66723531eebe2fd00f43ac0) Author [@turnekybc](https://github.com/turnekybc) - Update per mono release v2025.8.1

### Patch Changes

- Updated dependencies [[`f83f25b`](https://github.com/tkhq/sdk/commit/f83f25ba33ef15dbd66723531eebe2fd00f43ac0)]:
  - @turnkey/http@3.8.0
  - @turnkey/crypto@2.5.0
  - @turnkey/wallet-stamper@1.0.8

## 5.5.0

### Minor Changes

- [#651](https://github.com/tkhq/sdk/pull/651) [`81e355c`](https://github.com/tkhq/sdk/commit/81e355c9a8321feffcac056916b65139cf35eeed) Author [@turnekybc](https://github.com/turnekybc) - Add Coinbase & MoonPay Fiat Onramp. View the [Fiat Onramp feature docs](https://docs.turnkey.com/wallets/fiat-on-ramp).

### Patch Changes

- Updated dependencies [[`81e355c`](https://github.com/tkhq/sdk/commit/81e355c9a8321feffcac056916b65139cf35eeed), [`6cde41c`](https://github.com/tkhq/sdk/commit/6cde41cfecdfb7d54abf52cc65e28ef0e2ad6ba3)]:
  - @turnkey/http@3.7.0
  - @turnkey/sdk-types@0.3.0
  - @turnkey/crypto@2.5.0
  - @turnkey/wallet-stamper@1.0.8

## 5.4.1

### Patch Changes

- [#787](https://github.com/tkhq/sdk/pull/787) [`0d1eb2c`](https://github.com/tkhq/sdk/commit/0d1eb2c464bac3cf6f4386f402604ecf8f373f15) Author [@andrewkmin](https://github.com/andrewkmin) - Add optional `organizationId` parameter to `loginWithPasskey()` and `loginWithWallet()` to allow targeting a specific organization.

## 5.4.0

### Minor Changes

- [#782](https://github.com/tkhq/sdk/pull/782) [`e90a478`](https://github.com/tkhq/sdk/commit/e90a478c9208d858b1144df9b2c2c7ba956c406e) Thanks [@r-n-o](https://github.com/r-n-o)! - Release v2025.7.16

### Patch Changes

- Updated dependencies [[`e90a478`](https://github.com/tkhq/sdk/commit/e90a478c9208d858b1144df9b2c2c7ba956c406e)]:
  - @turnkey/http@3.6.0
  - @turnkey/crypto@2.4.3
  - @turnkey/wallet-stamper@1.0.7

## 5.3.4

### Patch Changes

- [#763](https://github.com/tkhq/sdk/pull/763) [`cb13c26`](https://github.com/tkhq/sdk/commit/cb13c26edb79a01ab651e3b2897334fd154b436a) Author [@andrewkmin](https://github.com/andrewkmin) - Release per mono v2025.7.1. This release contains the following API changes:

  - Introduction of `SmartContractInterfaces`: we've now exposed endpoints for uploading ABIs and IDLs to help secure EVM and Solana signing flows. For more information, see our docs [here](https://docs.turnkey.com/concepts/policies/smart-contract-interfaces)

- Updated dependencies [[`cb13c26`](https://github.com/tkhq/sdk/commit/cb13c26edb79a01ab651e3b2897334fd154b436a)]:
  - @turnkey/http@3.5.1
  - @turnkey/crypto@2.4.3
  - @turnkey/wallet-stamper@1.0.7

## 5.3.3

### Patch Changes

- [#750](https://github.com/tkhq/sdk/pull/750) [`2c4f42c`](https://github.com/tkhq/sdk/commit/2c4f42c747ac8017cf17e86b0ca0c3fa6f593bbf) Thanks [@moe-dev](https://github.com/moe-dev)! - Surface keyFormat for extractKeyEncryptedBundle in iframe client abstraction

## 5.3.2

### Patch Changes

- Updated dependencies [[`6cbff7a`](https://github.com/tkhq/sdk/commit/6cbff7a0c0b3a9a05586399e5cef476154d3bdca)]:
  - @turnkey/crypto@2.4.3
  - @turnkey/wallet-stamper@1.0.7

## 5.3.1

### Patch Changes

- [#716](https://github.com/tkhq/sdk/pull/716) [`fa46701`](https://github.com/tkhq/sdk/commit/fa467019eef34b5199372248edff1e7a64934e79) Author [@moeodeh3](https://github.com/moeodeh3) - Updated dependencies

  - bs58check@4.0.0

- Updated dependencies [[`c5cdf82`](https://github.com/tkhq/sdk/commit/c5cdf8229da5da1bd6d52db06b2fe42826e96d57), [`fa46701`](https://github.com/tkhq/sdk/commit/fa467019eef34b5199372248edff1e7a64934e79)]:
  - @turnkey/crypto@2.4.2
  - @turnkey/wallet-stamper@1.0.6

## 5.3.0

### Minor Changes

- [#704](https://github.com/tkhq/sdk/pull/704) [`5f3dd98`](https://github.com/tkhq/sdk/commit/5f3dd9814650308b3bf3198168c453e7b1a98efd) Author [@amircheikh](https://github.com/amircheikh) - Synced with mono 2025.6.10 to include the following endpoints:

  `update_user_email`: Update a User's email in an existing Organization

  `update_user_name`: Update a User's name in an existing Organization

  `update_user_phone_number`: Update a User's phone number in an existing Organization

### Patch Changes

- Updated dependencies [[`5f3dd98`](https://github.com/tkhq/sdk/commit/5f3dd9814650308b3bf3198168c453e7b1a98efd), [`7625df0`](https://github.com/tkhq/sdk/commit/7625df0538002c3455bd5862211210e38472e164), [`878e039`](https://github.com/tkhq/sdk/commit/878e03973856cfec83e6e3fda5b76d1b64943628)]:
  - @turnkey/http@3.5.0
  - @turnkey/api-key-stamper@0.4.7
  - @turnkey/crypto@2.4.1
  - @turnkey/wallet-stamper@1.0.5
  - @turnkey/indexed-db-stamper@1.1.1

## 5.2.3

### Patch Changes

- Updated dependencies [[`039602a`](https://github.com/tkhq/sdk/commit/039602a015d20783952b992d1d339f5fc003f658)]:
  - @turnkey/sdk-types@0.2.1

## 5.2.2

### Patch Changes

- Updated dependencies [[`0dd3fc3`](https://github.com/tkhq/sdk/commit/0dd3fc31956992c5b449da5868f6eef8b0bb194c)]:
  - @turnkey/sdk-types@0.2.0

## 5.2.1

### Patch Changes

- Updated dependencies [[`be0a621`](https://github.com/tkhq/sdk/commit/be0a621fb962bd51d2df1a1e79f5260d7c696772)]:
  - @turnkey/http@3.4.2
  - @turnkey/crypto@2.4.0
  - @turnkey/wallet-stamper@1.0.4

## 5.2.0

### Minor Changes

- [#659](https://github.com/tkhq/sdk/pull/659) [`5afbe51`](https://github.com/tkhq/sdk/commit/5afbe51949bdd1997fad083a4c1e4272ff7409dc) Author [@turnekybc](https://github.com/turnekybc) - export types and models from @turnkey/sdk-browser

### Patch Changes

- [#653](https://github.com/tkhq/sdk/pull/653) [`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a) Thanks [@moe-dev](https://github.com/moe-dev)! - Allow external keys to be passed to resetKeyPair in the indexedDbClient/Stamper enabling refreshing RW sessions

- [#663](https://github.com/tkhq/sdk/pull/663) [`593de2d`](https://github.com/tkhq/sdk/commit/593de2d9404ec8cf53426f9cf832c13eefa3fbf2) Thanks [@moe-dev](https://github.com/moe-dev)! - Update to endpoints as per mono v2025.5.7. Add V5 TON address format generation. Non breaking

- Updated dependencies [[`5afbe51`](https://github.com/tkhq/sdk/commit/5afbe51949bdd1997fad083a4c1e4272ff7409dc), [`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a), [`10ee5c5`](https://github.com/tkhq/sdk/commit/10ee5c524b477ce998e4fc635152cd101ae5a9cc), [`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a), [`593de2d`](https://github.com/tkhq/sdk/commit/593de2d9404ec8cf53426f9cf832c13eefa3fbf2)]:
  - @turnkey/wallet-stamper@1.0.4
  - @turnkey/webauthn-stamper@0.5.1
  - @turnkey/encoding@0.5.0
  - @turnkey/crypto@2.4.0
  - @turnkey/indexed-db-stamper@1.1.0
  - @turnkey/http@3.4.1
  - @turnkey/api-key-stamper@0.4.6

## 5.1.0

### Minor Changes

- Update @turnkey/sdk-types readme and install dependency in packages with common types

- [#650](https://github.com/tkhq/sdk/pull/650) [`27fe590`](https://github.com/tkhq/sdk/commit/27fe590cdc3eb6a8cde093eeefda2ee1cdc79412) Author [@turnekybc](https://github.com/turnekybc) - Update @turnkey/sdk-types readme and install dependency in packages with common types

### Patch Changes

- Updated dependencies [[`27fe590`](https://github.com/tkhq/sdk/commit/27fe590cdc3eb6a8cde093eeefda2ee1cdc79412)]:
  - @turnkey/sdk-types@0.1.0

## 5.0.0

### Major Changes

- [#601](https://github.com/tkhq/sdk/pull/601) [`07dfd33`](https://github.com/tkhq/sdk/commit/07dfd3397472687092e1c73b1d68714f421b9ca0) Author [@moe-dev](https://github.com/moe-dev)

This release introduces the new `indexedDbClient`, leveraging the `indexedDbStamper` to securely store cryptographic keys directly in IndexedDB. It provides persistent, secure, non-extractable authentication, replacing legacy iframe-based flows for OTP, passkey, external wallet, and OAuth authentications.

### Key Changes:

- **IndexedDB Client (`indexedDbClient`)**:

  - Offers persistent, tamper-resistant authentication using P-256 keys stored securely in IndexedDB.
  - Eliminates the need for credential injection via iframes, significantly improving the DevEx and UX of session management.
  - Provides human-readable sessions through `getSession()`.

- **Deprecation Notice**:
  - Authentication via the `iframeClient` (e.g., `auth.turnkey.com`) is deprecated. Developers should migrate authentication flows to the new IndexedDB-based client.
  - Existing iframe-based wallet flows (Email Recovery, Import, and Export) remain supported.

These enhancements simplify integrations, improve UX, and deliver a more robust client-side experience.

### Patch Changes

- Updated dependencies [[`07dfd33`](https://github.com/tkhq/sdk/commit/07dfd3397472687092e1c73b1d68714f421b9ca0)]:
  - @turnkey/indexed-db-stamper@1.0.0
  - @turnkey/http@3.4.0
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 4.3.0

### Minor Changes

- 25ca339: Adding replyToEmailAddress field for specifying reply-to when using a customer sender

### Patch Changes

- Updated dependencies [25ca339]
  - @turnkey/http@3.3.0
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 4.2.0

### Minor Changes

- 3f6e415: Update per mono v2025.4.5

### Patch Changes

- Updated dependencies [3f6e415]
- Updated dependencies [4d1d775]
  - @turnkey/http@3.2.0
  - @turnkey/api-key-stamper@0.4.5
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 4.1.0

### Minor Changes

- 3e4a482: Release per mono v2025.4.4

### Patch Changes

- Updated dependencies [3e4a482]
  - @turnkey/http@3.1.0
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 4.0.0

### Major Changes

- d1083bd: initOtpAuth now defaults to v2 (breaking) which allows alphanumeric boolean and otpLength (6-9) to be passed. More details below.

- This release introduces the `INIT_OTP_AUTH_V2` activity. The difference between it and `INIT_OTP_AUTH` is that it can now accept `alphanumeric` and `otpLength` for selecting crockford bech32 alphanumeric codes and the length of those codes. By default alphanumeric = true, otpLength = 9

- This release introduces `sendFromEmailSenderName` to `INIT_OTP_AUTH`, `INIT_OTP_AUTH_V2`, `EMAIL_AUTH` and `EMAIL_AUTH_V2`. This is an optional custom sender name for use with sendFromEmailAddress; if left empty, will default to 'Notifications'.

### Minor Changes

- e501690: Add new utility functions:

  - Add `clearEmbeddedKey()` async function, which clears the embedded key within an iframe
  - Add `initEmbeddedKey()` async function, which reinitializes the embedded key within an iframe

  These can be used in tandem to reset the embedded key within an iframe. See demo video in this PR's description: https://github.com/tkhq/sdk/pull/571

  Usage may look like the following:

  ```javascript
  import { Turnkey } from "@turnkey/sdk-browser";

  ...

  // create an instance of TurnkeyBrowserSDK
  const turnkeyBrowserSDK = new Turnkey(config);

  // create an instance of TurnkeyIframeClient
  const iframeClient = await turnkeyBrowserSDK.iframeClient({
    iframeContainer: document.getElementById(
      "turnkey-auth-iframe-container-id",
    ),
    iframeUrl: "https://auth.turnkey.com",
    iframeElementId: "turnkey-auth-iframe-element-id",
  });

  ...

  // Clear the existing embedded key
  await iframeClient.clearEmbeddedKey();

  const newPublicKey = await iframeClient.initEmbeddedKey();
  ```

### Patch Changes

- Updated dependencies [e501690]
- Updated dependencies [d1083bd]
- Updated dependencies [f94d36e]
  - @turnkey/iframe-stamper@2.5.0
  - @turnkey/http@3.0.0
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 3.1.0

### Minor Changes

- bf87774: Expose `getEmbeddedPublicKey()` via `TurnkeyIframeClient`. This can be used to fetch the live public key of the target embedded key living within an iframe.

  Usage may look like the following:

  ```javascript
  import { Turnkey } from "@turnkey/sdk-browser";

  // create an instance of TurnkeyBrowserSDK
  const turnkeyBrowserSDK = new Turnkey(config);

  // create an instance of TurnkeyIframeClient
  const iframeClient = await turnkeyBrowserSDK.iframeClient({
    iframeContainer: document.getElementById(
      "turnkey-auth-iframe-container-id",
    ),
    iframeUrl: "https://auth.turnkey.com",
    iframeElementId: "turnkey-auth-iframe-element-id",
  });

  ...

  const publicKey = await iframeClient.getEmbeddedPublicKey();
  ```

  Functionally, this can be useful for scenarios where the developer would like to verify whether an iframe has a live embedded key within it. This contrasts from the static `iframeStamper.iframePublicKey` exposed by `@turnkey/iframe-stamper`'s `publicKey()` method.

### Patch Changes

- Updated dependencies [a833088]
  - @turnkey/iframe-stamper@2.4.0

## 3.0.1

### Patch Changes

- 5ec5187: Fix initOtpAuth bug with improper version result (to be updated to V2 following release r2025.3.8)

## 3.0.0

### Major Changes

- 72890f5: ### @turnkey/sdk-browser

  - Move all type definitions to [`./__types__/base.ts`](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts)
  - `TurnkeyBrowserClient`
    - `refereshSession()` now consumes a [RefreshSessionParams](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L213) parameter
    - `loginWithBundle()` now consumes a [LoginWithBundleParams](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L219) parameter
    - `loginWithPasskey()` now consumes a [LoginWithPasskeyParams](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L224) parameter
    - `loginWithWallet()` now consumes a [LoginWithWalletParams](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L231) parameter

  ### @turnkey/sdk-react

  - `Auth.tsx`
    - updated `passkeyClient?.loginWithPasskey()` to implement new method signature
    - updated `walletClient?.loginWithWallet()` to implement new method signature

  ### @turnkey/sdk-server

  - Move all type definitions to [`./__types__/base.ts`](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-server/src/__types__/base.ts)

### Minor Changes

- ecdb29a: Update API as per mono v2025.3.2 - Add CREATE_USERS_V3

### Patch Changes

- 0e4e959: bump update policy activity to v2
- 856f449: update `TurnkeyBrowserClient.login()` to align with other functions like `loginWithPasskey()` and `loginWithWallet()`
- d4ce5fa: fix unexpected error when using read-only session type when calling loginWithPasskey & loginWithWallet
- Updated dependencies [ecdb29a]
  - @turnkey/http@2.22.0
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 2.0.0

### Major Changes

- 93540e7: ## Major Package Updates

  ### @turnkey/sdk-browser

  - create abstract `TurnkeyBaseClient` class which extends `TurnkeySDKClientBase`
    - `TurnkeyBrowserClient`, `TurnkeyIframeClient`, `TurnkeyPasskeyClient`, and `TurnkeyWalletClient` all extend `TurnkeyBaseClient`
  - TurnkeyBrowserClient
    - Session Management
      - `refreshSession` - attempts to refresh an existing, active session and will extend the session expiry using the `expirationSeconds` parameter
      - loginWithBundle - authenticate a user via a credential bundle and creates a read-write session
      - loginWithPasskey - attempts to authenticate a user via passkey and create a read-only or read-write session
      - loginWithSession - takes a `Session`, which can be either read-only or read-write, created via a server action and attempts to authenticate the user
  - TurnkeyPasskeyClient
    - Session Management
      - createPasskeySession - leverages passkey authentication to create a read-write session. Once authenticated, the user will not be prompted for additional passkey taps.

  ### @turnkey/sdk-react

  - update `TurnkeyContext` to use new `.getSession()` method to check if there is an active session
  - `OTPVerification` component no longer receives `authIframeClient` or `onValidateSuccess` props

  ## Minor Package Updates

  ### @turnkey/sdk-server

  - expose `sendCredential` server action
  - add `SessionType` enum
    - `READ_ONLY` & `READ_WRITE`

  ### @turnkey/eip-1193-provider

  - update dependencies in `package.json`
    - moved from `peerDependencies` to `dependencies`
      - `"@turnkey/http": "workspace:*"`
      - `"@turnkey/sdk-browser": "workspace:*"`
    - moved from `devDependencies` to `dependencies`
      - `"@turnkey/api-key-stamper": "workspace:*"`
  - specify TypeScript version ^5.1.5

### Minor Changes

- 9147962: add dangerouslyOverrideIframeKeyTtl option to override iframe embedded key TTL (for longer lived read/write sessions)

### Patch Changes

- Updated dependencies [9147962]
  - @turnkey/iframe-stamper@2.3.0
  - @turnkey/crypto@2.3.1

## 1.16.0

### Minor Changes

- 233ae71: Add updateUserAuth, addUserAuth, deleteUserAuth helper functions

### Patch Changes

- @turnkey/crypto@2.3.1

## 1.15.0

### Minor Changes

- 56a307e: Update api to mono v2025.3.0

### Patch Changes

- Updated dependencies [56a307e]
  - @turnkey/http@2.21.0
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 1.14.0

### Minor Changes

- 3c44c4a: Updates per mono release v2025.2.2

### Patch Changes

- Updated dependencies [3c44c4a]
  - @turnkey/http@2.20.0
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 1.13.0

### Minor Changes

- 57f9cb0: Update endpoints - surface GetWalletAccount

### Patch Changes

- 69d2571: Upgrade elliptic
- Updated dependencies [57f9cb0]
  - @turnkey/http@2.19.0
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 1.12.1

### Patch Changes

- 755833b: refactor stamper out of config object and move it directly onto the client to match @turnkey/http
- Updated dependencies [2bc0046]
  - @turnkey/crypto@2.3.1
  - @turnkey/wallet-stamper@1.0.3

## 1.12.0

### Minor Changes

- 6695af2: Update per mono release v2025.1.11

### Patch Changes

- Updated dependencies [6695af2]
  - @turnkey/http@2.18.0
  - @turnkey/crypto@2.3.0
  - @turnkey/wallet-stamper@1.0.2

## 1.11.2

### Patch Changes

- 053fbfb: Update mono dependencies
- Updated dependencies [053fbfb]
- Updated dependencies [a216a47]
  - @turnkey/http@2.17.3
  - @turnkey/iframe-stamper@2.2.0
  - @turnkey/crypto@2.3.0
  - @turnkey/wallet-stamper@1.0.2

## 1.11.1

### Patch Changes

- 328d6aa: Add defaultXrpAccountAtIndex helper
- b90947e: Update default account exports, surface WalletAccount type
- 2d5977b: Update error messaging around api key and target public key usage
- fad7c37: @turnkey/iframe-stamper - Implemented MessageChannel API for secure communication between the parent and iframe.

  @turnkey/sdk-browser - fixed spelling in package.json
  @turnkey/sdk-server - fixed spelling in package.json

- Updated dependencies [2d5977b]
- Updated dependencies [fad7c37]
  - @turnkey/api-key-stamper@0.4.4
  - @turnkey/iframe-stamper@2.1.0
  - @turnkey/crypto@2.3.0
  - @turnkey/http@2.17.2
  - @turnkey/wallet-stamper@1.0.2

## 1.11.0

### Minor Changes

- 7988bc1: Fix readWrite session to use credentialBundle and add loginWithAuthBundle to create a session when you already have a credentialBundle

### Patch Changes

- 538d4fc: Update api endpoints - NEW: User verification, SMS customization params
- 12d5aaa: Update TurnkeySDKBrowserConfig type with an optional iframeUrl field. The TurnkeyContext provider will check for an iframeUrl otherwise it will fallback to the default.
- Updated dependencies [c895c8f]
- Updated dependencies [538d4fc]
  - @turnkey/wallet-stamper@1.0.2
  - @turnkey/http@2.17.1
  - @turnkey/crypto@2.3.0

## 1.10.2

### Patch Changes

- Updated dependencies [668edfa]
  - @turnkey/crypto@2.3.0
  - @turnkey/wallet-stamper@1.0.1

## 1.10.1

### Patch Changes

- Updated dependencies [78bc39c]
  - @turnkey/http@2.17.0
  - @turnkey/crypto@2.2.0
  - @turnkey/wallet-stamper@1.0.0

## 1.10.0

### Minor Changes

##### `TurnkeyWalletClient`

- Added new `TurnkeyWalletClient` to the `@turnkey/sdk-browser`
  **Reason**: Allows using the `WalletStamper` with the browser sdk
- Added `getPublicKey` method to `TurnkeyWalletClient`
  **Reason**: Enables easy access to wallet public key for sub-organization creation and future authentication flows
- Updated `TurnkeyWalletClient` to use new `WalletInterface`
  **Reason**: Ensures compatibility with the updated Wallet Stamper interfaces

##### `AuthClient` (new enum)

- Introduced a new enum to track which client is authenticated (Passkey, Wallet, Iframe)

##### `TurnkeyBrowserClient`, `TurnkeyIframeClient`, `TurnkeyPasskeyClient`, `TurnkeyWalletClient`

- Added a static `authClient` property to base `TurnkeyBrowserClient` to be used by the child classes to track which client was used for the initial authentication

##### `UserSession` interface

- Added a new `UserSession` interface which is to be stored in local storage to track the authentication state of the user and to eliminate the need to store the write and read sessions separately.
- Added `authClient` in the session object to store the authentication method used in the user's session data. Will be used in the `@turnkey/sdk-react` to determine which client to return.
- Added new versioned `UserSession` key: `"@turnkey/session/v1"`

##### `login` and `loginWithReadWriteSession` methods

- Updated to use the new `authClient` property to track and store the authentication method used during login

### Patch Changes

- Updated dependencies [8bea78f]
  - @turnkey/wallet-stamper@2.0.0
  - @turnkey/crypto@2.2.0

## 1.9.0

### Minor Changes

- 3dd74ac: Added functionality for constructing and returning stamped requests for all packages
- 1e36edf: Support RS256 by default when invoking createUserPasskey
- 4df8914: Version bump corresponding to mono release v2024.10.10. More detailed changelog to follow
- 11a9e2f: Allow override of WebauthnStamper configuration

### Patch Changes

- Updated dependencies [33e8e03]
- Updated dependencies [d989d46]
- Updated dependencies [4df8914]
  - @turnkey/crypto@2.1.0
  - @turnkey/http@2.16.0

## 1.8.0

### Minor Changes

- 9ebd062: Release OTP functionality

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/http@2.15.0

## 1.7.1

### Patch Changes

- 96d7f99: Update dependencies
- Updated dependencies [e5c4fe9]
- Updated dependencies [96d7f99]
  - @turnkey/crypto@2.0.0
  - @turnkey/encoding@0.4.0
  - @turnkey/http@2.14.2
  - @turnkey/api-key-stamper@0.4.3

## 1.7.0

### Minor Changes

- ff059d5: Add ability to create a read + write session

### Patch Changes

- Updated dependencies [ff059d5]
- Updated dependencies [93666ff]
  - @turnkey/http@2.14.1
  - @turnkey/crypto@1.0.0
  - @turnkey/encoding@0.3.0
  - @turnkey/api-key-stamper@0.4.2

## 1.6.0

### Minor Changes

- c988ed0: Support activity polling (e.g. for awaiting consensus)

  - [Breaking] Update the `activityPoller` parameter for configuring polling behavior
  - Polling continues until either a max number of retries is reached, or if the activity hits a terminal status

  The shape of the parameter has gone from:

  ```
  {
    duration: number;
    timeout: number;
  }
  ```

  to

  ```
  {
    intervalMs: number;
    numRetries: number;
  }
  ```

### Patch Changes

- Updated dependencies [848f8d3]
  - @turnkey/http@2.14.0

## 1.5.0

### Minor Changes

- 1813ed5: Allow `organizationId` override for `TurnkeyBrowserClient.login` with an extra `config` argument

## 1.4.0

### Minor Changes

- bab5393: Add keyformat to key export bundle injection

### Patch Changes

- a16073c: Exposes storage APIs used by the sdk for managing users & sessions
- 7e7d209: Add authenticatorAttachment option

## 1.3.0

### Minor Changes

- 93dee46: Add create read write session v2 which allows for user targeting directly from stamp or optional userId in intent

### Patch Changes

- Updated dependencies [93dee46]
  - @turnkey/http@2.13.0

## 1.2.4

### Patch Changes

- Updated dependencies [e2f2e0b]
  - @turnkey/http@2.12.3

## 1.2.3

### Patch Changes

- Fix activity versioning for CREATE_SUB_ORGANIZATION (V5=>V6)

## 1.2.2

### Patch Changes

- f4b607f: Verify and pad uncompressed public keys while creating passkey sessions

- Updated dependencies
  - @turnkey/api-key-stamper@0.4.1
  - @turnkey/encoding@0.2.1
  - @turnkey/http@2.12.2
  - @turnkey/crypto@0.2.1

## 1.2.1

### Patch Changes

- f17a229: Update to oauth related endpoints to drop jwks uri from oauth providers
- Updated dependencies [f17a229]
  - @turnkey/http@2.12.1

## 1.2.0

### Minor Changes

- Add Email Auth V2 - Optional invalidate exisiting Email Authentication API keys

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.0

## 1.1.0

### Minor Changes

- Update to use new endpoints. Including CREATE_READ_WRITE_SESSION which allows one shot passkey sessions (returns org information and a credential bundle) and CREATE_API_KEYS_V2 which allows a curve type to be passed (SECP256K1 or P256)

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.11.0

## 1.0.0

### Major Changes

- Stable Release: Add Oauth integration. New suborg creation version will now require an oauthProviders field under root users.

## 0.4.1

### Patch Changes

- Updated dependencies
  - @turnkey/crypto@0.2.0

## 0.4.0

### Minor Changes

- e4b29da: Deprecate the `getAuthBundle()` path for passkey sessions and replace it with `getReadWriteSession()` to store authBundles with their expirationTimestamps so applications can better manually manage active writing sessions

## 0.3.0

### Minor Changes

- d409d81: Add support for Passkey Sessions

## 0.2.1

### Patch Changes

- Updated dependencies [5d0bfde]
- Updated dependencies [2f2d09a]
- Updated dependencies [976663e]
  - @turnkey/iframe-stamper@2.0.0

## 0.2.0

### Minor Changes

- updated syntax

### Patch Changes

- Updated dependencies [5d0bfde]
- Updated dependencies [2f2d09a]
- Updated dependencies [976663e]
  - @turnkey/iframe-stamper@2.0.0

## 0.1.0

### Minor Changes

- Ready for 0.1.0

## 0.0.1

Initial (experimental) release! This is an alpha release and subject to change.
