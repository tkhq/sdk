# @turnkey/sdk-server

## 4.0.0

### Major Changes

- [#601](https://github.com/tkhq/sdk/pull/601) [`07dfd33`](https://github.com/tkhq/sdk/commit/07dfd3397472687092e1c73b1d68714f421b9ca0) Author [@moe-dev](https://github.com/moe-dev).

This release introduces significant updates and new actions to the SDK server methods, enhancing authentication flows and simplifying usage:

**Updated Actions:**

- `sendOtp`: No longer requires a suborganization ID; OTPs can now be sent directly under a parent organization's context to any email or phone number.

- `verifyOtp`: Now returns a `verificationToken`, which is required for creating sessions via the new `otpLogin` action.

**New Actions:**

- `otpLogin`: Creates a session using a previously obtained `verificationToken`. Returns a session JWT.

- `oauthLogin`: Authenticates using an OIDC token obtained from a third-party provider (e.g., Google, Apple, Facebook). Returns a session JWT.

These changes standardize authentication processes, simplify integration, and streamline session management across the SDK.

### Patch Changes

- [#631](https://github.com/tkhq/sdk/pull/631) [`e8a5f1b`](https://github.com/tkhq/sdk/commit/e8a5f1b431623c4ff1cb85c6039464b328cf0e6a) Author [@andrewkmin](https://github.com/andrewkmin) - Remove unused Next.js dependency

  - while the `"use server"` directive in `actions.ts` is to be used specifically with Next, removing it from this package (`@turnkey/sdk-server`) is fine, though applications _using_ this package will need Next.js

- Updated dependencies [[`07dfd33`](https://github.com/tkhq/sdk/commit/07dfd3397472687092e1c73b1d68714f421b9ca0)]:
  - @turnkey/http@3.4.0
  - @turnkey/wallet-stamper@1.0.3

## 3.3.0

### Minor Changes

- 25ca339: Adding replyToEmailAddress field for specifying reply-to when using a customer sender

### Patch Changes

- Updated dependencies [25ca339]
  - @turnkey/http@3.3.0
  - @turnkey/wallet-stamper@1.0.3

## 3.2.0

### Minor Changes

- 3f6e415: Update per mono v2025.4.5

### Patch Changes

- Updated dependencies [3f6e415]
- Updated dependencies [4d1d775]
  - @turnkey/http@3.2.0
  - @turnkey/api-key-stamper@0.4.5
  - @turnkey/wallet-stamper@1.0.3

## 3.1.0

### Minor Changes

- 3e4a482: Release per mono v2025.4.4

### Patch Changes

- Updated dependencies [3e4a482]
  - @turnkey/http@3.1.0
  - @turnkey/wallet-stamper@1.0.3

## 3.0.1

### Patch Changes

- 7b72769: Add sendFromEmailSenderName to sendOtp server action

## 3.0.0

### Major Changes

- d1083bd: initOtpAuth now defaults to v2 (breaking) which allows alphanumeric boolean and otpLength (6-9) to be passed + associated updates to server actions. More details below.

- This release introduces the `INIT_OTP_AUTH_V2` activity. The difference between it and `INIT_OTP_AUTH` is that it can now accept `alphanumeric` and `otpLength` for selecting crockford bech32 alphanumeric codes and the length of those codes. By default alphanumeric = true, otpLength = 9

- This release introduces `sendFromEmailSenderName` to `INIT_OTP_AUTH`, `INIT_OTP_AUTH_V2`, `EMAIL_AUTH` and `EMAIL_AUTH_V2`. This is an optional custom sender name for use with sendFromEmailAddress; if left empty, will default to 'Notifications'.

### Patch Changes

- Updated dependencies [d1083bd]
- Updated dependencies [f94d36e]
  - @turnkey/http@3.0.0
  - @turnkey/wallet-stamper@1.0.3

## 2.6.1

### Patch Changes

- 5ec5187: Fix initOtpAuth bug with improper version result (to be updated to V2 following release r2025.3.8)

## 2.6.0

### Minor Changes

- ecdb29a: Update API as per mono v2025.3.2 - Add CREATE_USERS_V3

### Patch Changes

- 0e4e959: bump update policy activity to v2
- c9ae537: Update nextJs to >= 15.2.3 as per github advisory: https://github.com/advisories/GHSA-f82v-jwr5-mffw

  For Next.js 15.x, this issue is fixed in 15.2.3
  For Next.js 14.x, this issue is fixed in 14.2.25
  For Next.js 13.x, this issue is fixed in 13.5.9
  For Next.js 12.x, this issue is fixed in 12.3.5

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

- Updated dependencies [ecdb29a]
  - @turnkey/http@2.22.0
  - @turnkey/wallet-stamper@1.0.3

## 2.5.0

### Minor Changes

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

### Patch Changes

- fdb8bf0: Add loading indicators for EWK. Exposed email customization to EWK.

## 2.4.0

### Minor Changes

- 9317588: Adds wallet as an authentication option in the Embedded Wallet Kit components for sdk-react

## 2.3.0

### Minor Changes

- 56a307e: Update api to mono v2025.3.0

### Patch Changes

- Updated dependencies [56a307e]
  - @turnkey/http@2.21.0

## 2.2.0

### Minor Changes

- 3c44c4a: Updates per mono release v2025.2.2

### Patch Changes

- bfc833f: Add getOrCreateSuborg server action
- Updated dependencies [3c44c4a]
  - @turnkey/http@2.20.0

## 2.1.0

### Minor Changes

- 57f9cb0: Update endpoints - surface GetWalletAccount

### Patch Changes

- 69d2571: Upgrade elliptic
- Updated dependencies [57f9cb0]
  - @turnkey/http@2.19.0

## 2.0.1

### Patch Changes

- 755833b: refactor stamper out of config object and move it directly onto the client to match @turnkey/http

## 2.0.0

### Major Changes

- 1ebd4e2: Add server actions

### Minor Changes

- 6695af2: Update per mono release v2025.1.11

### Patch Changes

- Updated dependencies [6695af2]
  - @turnkey/http@2.18.0

## 1.7.3

### Patch Changes

- 053fbfb: Update mono dependencies
- Updated dependencies [053fbfb]
  - @turnkey/http@2.17.3

## 1.7.2

### Patch Changes

- 328d6aa: Add defaultXrpAccountAtIndex helper
- b90947e: Update default account exports, surface WalletAccount type
- fad7c37: @turnkey/iframe-stamper - Implemented MessageChannel API for secure communication between the parent and iframe.

  @turnkey/sdk-browser - fixed spelling in package.json
  @turnkey/sdk-server - fixed spelling in package.json

- Updated dependencies [2d5977b]
  - @turnkey/api-key-stamper@0.4.4
  - @turnkey/http@2.17.2

## 1.7.1

### Patch Changes

- 538d4fc: Update api endpoints - NEW: User verification, SMS customization params
- Updated dependencies [538d4fc]
  - @turnkey/http@2.17.1

## 1.7.0

### Minor Changes

- 78bc39c: Add default accounts for various address types
  - Add wallet account ID to list wallets endpoint

### Patch Changes

- Updated dependencies [78bc39c]
  - @turnkey/http@2.17.0

## 1.6.0

### Minor Changes

- 3dd74ac: Added functionality for constructing and returning stamped requests for all packages
- 4df8914: Version bump corresponding to mono release v2024.10.10. More detailed changelog to follow

### Patch Changes

- Updated dependencies [4df8914]
  - @turnkey/http@2.16.0

## 1.5.0

### Minor Changes

- 9ebd062: Release OTP functionality

### Patch Changes

- Updated dependencies [9ebd062]
  - @turnkey/http@2.15.0

## 1.4.2

### Patch Changes

- abe7138: Export DEFAULT_SOLANA_ACCOUNTS
- 96d7f99: Update dependencies
- Updated dependencies [96d7f99]
  - @turnkey/http@2.14.2
  - @turnkey/api-key-stamper@0.4.3

## 1.4.1

### Patch Changes

- ff059d5: Update dependencies
- Updated dependencies [ff059d5]
  - @turnkey/http@2.14.1
  - @turnkey/api-key-stamper@0.4.2

## 1.4.0

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

- Updated dependencies [2d7e5a9]
  - @turnkey/api-key-stamper@0.4.1
  - @turnkey/http@2.12.2

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

## 0.2.0

### Minor Changes

- updated syntax

### Patch Changes

- e4d2a84: Update client name

## 0.1.0

### Minor Changes

- Ready for 0.1.0

## 0.0.1

Initial (experimental) release! This is an alpha release and subject to change.
