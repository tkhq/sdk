# @turnkey/http

## 3.10.0

### Minor Changes

- [#861](https://github.com/tkhq/sdk/pull/861) [`5d8be2d`](https://github.com/tkhq/sdk/commit/5d8be2d0329070c7aa025dddb1b28f04257ae4e6) Author [@amircheikh](https://github.com/amircheikh) - Synced as per mono 2025.8.4

## 3.9.0

### Minor Changes

- [#834](https://github.com/tkhq/sdk/pull/834) [`8b39dba`](https://github.com/tkhq/sdk/commit/8b39dbabf68d3e376b5b07f26960d5b61ae87fa9) Author [@moeodeh3](https://github.com/moeodeh3) - Update per mono release v2025.8.3-hotfix.0

## 3.8.0

### Minor Changes

- [#826](https://github.com/tkhq/sdk/pull/826) [`f83f25b`](https://github.com/tkhq/sdk/commit/f83f25ba33ef15dbd66723531eebe2fd00f43ac0) Author [@turnekybc](https://github.com/turnekybc) - Update per mono release v2025.8.1

## 3.7.0

### Minor Changes

- [#651](https://github.com/tkhq/sdk/pull/651) [`81e355c`](https://github.com/tkhq/sdk/commit/81e355c9a8321feffcac056916b65139cf35eeed) Author [@turnekybc](https://github.com/turnekybc) - Add Coinbase & MoonPay Fiat Onramp. View the [Fiat Onramp feature docs](https://docs.turnkey.com/wallets/fiat-on-ramp).

## 3.6.0

### Minor Changes

- [#782](https://github.com/tkhq/sdk/pull/782) [`e90a478`](https://github.com/tkhq/sdk/commit/e90a478c9208d858b1144df9b2c2c7ba956c406e) Thanks [@r-n-o](https://github.com/r-n-o)! - Release v2025.7.16

## 3.5.1

### Patch Changes

- [#763](https://github.com/tkhq/sdk/pull/763) [`cb13c26`](https://github.com/tkhq/sdk/commit/cb13c26edb79a01ab651e3b2897334fd154b436a) Author [@andrewkmin](https://github.com/andrewkmin) - Release per mono v2025.7.1. This release contains the following API changes:

  - Introduction of `SmartContractInterfaces`: we've now exposed endpoints for uploading ABIs and IDLs to help secure EVM and Solana signing flows. For more information, see our docs [here](https://docs.turnkey.com/concepts/policies/smart-contract-interfaces)

## 3.5.0

### Minor Changes

- [#704](https://github.com/tkhq/sdk/pull/704) [`5f3dd98`](https://github.com/tkhq/sdk/commit/5f3dd9814650308b3bf3198168c453e7b1a98efd) Author [@amircheikh](https://github.com/amircheikh) - Added `name` field to constructor. `isHttpClient` now uses this new field to complete the check. This fixes a bug where `isHttpClient` would fail the check under certain production environments.

  Synced with mono 2025.6.10 to include the following endpoints:

  `update_user_email`: Update a User's email in an existing Organization

  `update_user_name`: Update a User's name in an existing Organization

  `update_user_phone_number`: Update a User's phone number in an existing Organization

### Patch Changes

- Updated dependencies [[`7625df0`](https://github.com/tkhq/sdk/commit/7625df0538002c3455bd5862211210e38472e164)]:
  - @turnkey/api-key-stamper@0.4.7

## 3.4.2

### Patch Changes

- [#665](https://github.com/tkhq/sdk/pull/665) [`be0a621`](https://github.com/tkhq/sdk/commit/be0a621fb962bd51d2df1a1e79f5260d7c696772) Author [@amircheikh](https://github.com/amircheikh) - Exposed `isHttpClient` function for determining if a passed in client is from turnkey/http

## 3.4.1

### Patch Changes

- [#663](https://github.com/tkhq/sdk/pull/663) [`593de2d`](https://github.com/tkhq/sdk/commit/593de2d9404ec8cf53426f9cf832c13eefa3fbf2) Thanks [@moe-dev](https://github.com/moe-dev)! - Update to endpoints as per mono v2025.5.7. Add V5 TON address format generation. Non breaking

- Updated dependencies [[`5afbe51`](https://github.com/tkhq/sdk/commit/5afbe51949bdd1997fad083a4c1e4272ff7409dc), [`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a)]:
  - @turnkey/webauthn-stamper@0.5.1
  - @turnkey/encoding@0.5.0
  - @turnkey/api-key-stamper@0.4.6

## 3.4.0

### Minor Changes

- Added new authentication activities:
  - STAMP_LOGIN: Handles authentication flows for passkeys, wallet logins, and session refresh. Initiated by sub-organizations; returns a session JWT.
  - INIT_OTP: Initiates sending a 6–9 digit or bech32 alphanumeric OTP to an email or phone. Initiated by the parent organization.
  - VERIFY_OTP: Verifies the OTP and returns a verification token. Initiated by the parent organization.
  - OTP_LOGIN: Completes OTP-based authentication by verifying a tokenized OTP challenge and establishing a session. Initiated by the parent organization; returns a session JWT.
  - OAUTH_LOGIN: Finalizes OAuth-based logins from third-party OIDC providers. Initiated by the parent organization; returns a session JWT.

## 3.3.0

### Minor Changes

- 25ca339: Adding replyToEmailAddress field for specifying reply-to when using a customer sender

## 3.2.0

### Minor Changes

- 3f6e415: Update per mono v2025.4.5
  - Introduces Tron transaction parsing and policy engine support. For more information, take a look at our [docs](https://docs.turnkey.com/networks/tron)

### Patch Changes

- Updated dependencies [4d1d775]
  - @turnkey/api-key-stamper@0.4.5

## 3.1.0

### Minor Changes

- 3e4a482: Release per mono v2025.4.4
  - Adds parsing and policy engine support for Ethereum Type 3 (EIP-4844) and Type 4 (EIP-7702) transactions. There is no change to any signing interface or API; you simply can now use Turnkey's signing endpoints to sign those transaction types. See [with-viem](https://github.com/tkhq/sdk/blob/main/examples/with-viem/) for examples.
  - New wallet account creations will now automatically derive the underlying derived account's public key. For example: previously, if derived an Ethereum wallet account, you would get the resulting Ethereum address (`0x...`). If you also wanted the public key associated with that underlying key, you would've had to derive an additional wallet account with `ADDRESS_FORMAT_COMPRESSED`. Now, this will automatically be derived for you. It is now a property that has been added to the wallet account primitive (i.e. accessible via `walletAccount.publicKey`).

## 3.0.0

### Major Changes

- f94d36e: Remove deprecated TurnkeyApiService. TurnkeyApi should be used instead.

### Minor Changes

- d1083bd: New activity `INIT_OTP_AUTH_V2` which allows alphanumeric boolean and otpLength (6-9) to be passed

- This release introduces the `INIT_OTP_AUTH_V2` activity. The difference between it and `INIT_OTP_AUTH` is that it can now accept `alphanumeric` and `otpLength` for selecting crockford bech32 alphanumeric codes and the length of those codes. By default alphanumeric = true, otpLength = 9

- This release introduces `sendFromEmailSenderName` to `INIT_OTP_AUTH`, `INIT_OTP_AUTH_V2`, `EMAIL_AUTH` and `EMAIL_AUTH_V2`. This is an optional custom sender name for use with sendFromEmailAddress; if left empty, will default to 'Notifications'.

## 2.22.0

### Minor Changes

- ecdb29a: Update API as per mono v2025.3.2

  - This release introduces the `CREATE_USERS_V3` activity. The difference between it and `CREATE_USERS_V2` is that it can now accept `userPhoneNumber` and `oauthProviders`. In total, it accepts the following parameters:

  ```javascript
  /** @description A list of Users. */
  users: {
    /** @description Human-readable name for a User. */
    userName: string;
    /** @description The user's email address. */
    userEmail?: string;
    /** @description The user's phone number in E.164 format e.g. +13214567890 */
    userPhoneNumber?: string;
    /** @description A list of API Key parameters. This field, if not needed, should be an empty array in your request body. */
    apiKeys: definitions["v1ApiKeyParamsV2"][];
    /** @description A list of Authenticator parameters. This field, if not needed, should be an empty array in your request body. */
    authenticators: definitions["v1AuthenticatorParamsV2"][];
    /** @description A list of Oauth providers. This field, if not needed, should be an empty array in your request body. */
    oauthProviders: definitions["v1OauthProviderParams"][];
    /** @description A list of User Tag IDs. This field, if not needed, should be an empty array in your request body. */
    userTags: string[];
  }
  ```

  See [source code](https://github.com/tkhq/sdk/blob/60c0c03440785b841d1f6f393612046423dc665f/packages/http/src/__generated__/services/coordinator/public/v1/public_api.types.ts#L2894-L2909) to view details on the nested types.

## 2.21.0

### Minor Changes

- 56a307e: Update API to mono v2025.3.0
  - This release introduces an `invalidateExisting` flag to the `CreateReadWriteSession` and `Oauth` activities. If enabled, this will invalidate existing read-write and oauth API keys. This is useful in scenarios where a user attempts to create numerous `ReadWrite` or `Oauth` sessions. Because our API caps the number of session keys associated with a user, this flag can clear all other existing session keys of that specific type (e.g. setting `invalidateExisting: true` for `CreateReadWriteSession` will invalidate all previously created read-write session keys)

## 2.20.0

### Minor Changes

- 3c44c4a: Updates per mono release v2025.2.2

## 2.19.0

### Minor Changes

- 57f9cb0: Update endpoints - surface `GetWalletAccount`. This endpoint takes in the following args:
  ```javascript
  /** @description Unique identifier for a given Organization. */
  organizationId: string;
  /** @description Unique identifier for a given Wallet. */
  walletId: string;
  /** @description Address corresponding to a Wallet Account. */
  address?: string;
  /** @description Path corresponding to a Wallet Account. */
  path?: string;
  ```

## 2.18.0

### Minor Changes

- 6695af2: Update per mono release v2025.1.11

## 2.17.3

### Patch Changes

- 053fbfb: Update mono dependencies

## 2.17.2

### Patch Changes

- Updated dependencies [2d5977b]
  - @turnkey/api-key-stamper@0.4.4

## 2.17.1

### Patch Changes

- 538d4fc: Update api endpoints - NEW: User verification, SMS customization params

## 2.17.0

### Minor Changes

- 78bc39c: Add default accounts for various address types
  - Add wallet account ID to list wallets endpoint

## 2.16.0

### Minor Changes

- 4df8914: Version bump corresponding to mono release v2024.10.10.
  - Improved error message for duplicate activity submission
  - Address derivation support for DOGE, TON, SEI, XLM
  - Fix server side error if sub_org doesn’t have email and/or phone number

## 2.15.0

### Minor Changes

- 9ebd062: Release OTP functionality

## 2.14.2

### Patch Changes

- 96d7f99: Update dependencies
- Updated dependencies [e5c4fe9]
  - @turnkey/encoding@0.4.0
  - @turnkey/api-key-stamper@0.4.3

## 2.14.1

### Patch Changes

- ff059d5: Update dependencies
- Updated dependencies [93666ff]
  - @turnkey/encoding@0.3.0
  - @turnkey/api-key-stamper@0.4.2

## 2.14.0

### Minor Changes

- 848f8d3: Add new helpers and update types and errors

  - `getSignatureFromActivity` returns the signature corresponding to a completed activity
  - `getSignedTransactionFromActivity` returns the signed transaction corresponding to a completed activity
  - `assertActivityCompleted` checks the state of an activity and throws an error if the activity either requires consensus or is otherwise not yet completed
  - `TERMINAL_ACTIVITY_STATUSES` is a const containing all terminal activity statuses. Useful for checking on an activity
  - `TurnkeyActivityError` now uses `undefined` instead of `null`
  - Export some additional types: `TActivity`, `TActivityId`, `TActivityStatus`, `TActivityType`

## 2.13.0

### Minor Changes

- 93dee46: Add create read write session v2 which allows for user targeting directly from stamp or optional userId in intent

## 2.12.3

### Patch Changes

- e2f2e0b: Added two new endpoints for deleting private keys and deleting wallets

## 2.12.2

### Patch Changes

- 2d7e5a9: fix a (currently unused) return value

- Updated dependencies
  - @turnkey/api-key-stamper@0.4.1
  - @turnkey/encoding@0.2.1

## 2.12.1

### Patch Changes

- f17a229: Update to oauth related endpoints to drop jwks uri from oauth providers

## 2.12.0

### Minor Changes

- Add Email Auth V2 - Optional invalidate exisiting Email Authentication API keys

## 2.11.0

### Minor Changes

- Update to use new endpoints. Including CREATE_READ_WRITE_SESSION which allows one shot passkey sessions (returns org information and a credential bundle) and CREATE_API_KEYS_V2 which allows a curve type to be passed (SECP256K1 or P256)

## 2.10.0

### Minor Changes

- 7a9ce7a: Sync 2024.3.16

## 2.9.1

### Patch Changes

- Update generated files to latest release: optional pagination options were added to list sub-organization and list wallet account endpoints.

## 2.9.0

### Minor Changes

- 83b62b5: Sync types for latest release

## 2.8.0

### Minor Changes

- 46a7d90: Update to v2024.2.1 API: add activities to initialize wallet import, import wallet, delete users, delete private key tags, delete user tags, and list sub-organizations

## 2.7.1

### Patch Changes

- Update to v2024.2.0 API types: `mnemonicLength` is now a number instead of a string

## 2.7.0

### Minor Changes

- Introduce and reference `@turnkey/encoding` to consolidate utility functions
- Updated dependencies ([c3b423b], [d73725b])
  - @turnkey/webauthn-stamper@0.5.0
  - @turnkey/api-key-stamper@0.4.0
  - @turnkey/encoding@0.1.0

## 2.6.2

### Patch Changes

- b45a9ac: Include package version in request headers
- f9d636c: Export VERSION from turnkey/http

## 2.6.1

### Patch Changes

- 52e2389: Revert version export (#186 and #187)

## 2.6.0

### Minor Changes

- 0794f41: Add VERSION constant
- 7a3c890: Add key export support

### Patch Changes

- 4517e3b: Update version string to include package name

## 2.5.1

### Patch Changes

- Upgrade to Node v18 (#184)
- Updated dependencies
  - @turnkey/webauthn-stamper@0.4.3
  - @turnkey/api-key-stamper@0.3.1

## 2.5.0

### Minor Changes

- 464ac0e: Update protos for latest release, which includes:

  - Support optional expirations for API keys, configurable via the `expirationSeconds` parameter.
  - Support Email Auth. Details to follow ⚡️

## 2.4.2

### Patch Changes

- Updated dependencies [a03e385]
  - @turnkey/webauthn-stamper@0.4.2

## 2.4.1

### Patch Changes

- Fix universal files to stop using `require`. Use ES6 imports instead (#178)
- Updated dependencies [f87ced8]
  - @turnkey/webauthn-stamper@0.4.1

## 2.4.0

### Minor Changes

- Use rollup to build ESM and CommonJS, fix ESM support (#174)

### Patch Changes

- Updated dependencies [fc5b291]
  - @turnkey/api-key-stamper@0.3.0
  - @turnkey/webauthn-stamper@0.4.0

## 2.3.1

### Patch Changes

- Updated dependencies
  - @turnkey/api-key-stamper@0.2.0

## 2.3.0

### Minor Changes

- Sync protos from latest public endpoints

## 2.2.0

### Minor Changes

- Add ESM to package dist (#154)

### Patch Changes

- ed50a0f: simplify types

## 2.1.0

### Minor Changes

- bb6ea0b: Update generated files
  - new query endpoints to retrieve wallets (`/public/v1/query/list_wallets`)
  - new query endpoint to retrieve wallet accounts (`/public/v1/query/list_wallet_accounts`)

## 2.0.0

### Major Changes

- Synced protos from mono

### Upgrade notes

- `signRawPayload` and `signTransaction` now expect a `signWith` param instead of `privateKeyId` previously
- `signRawPayload` and `signTransaction` have been updated to expect a new type: `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` and `ACTIVITY_TYPE_SIGN_TRANSACTION_V2`, respectively
- If you have policies authorizing `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD` or `ACTIVITY_TYPE_SIGN_TRANSACTION` specifically, they will need to be updated to authorize `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` and `ACTIVITY_TYPE_SIGN_TRANSACTION_V2` (or better yet, update your policies to allow all signing actions categorically using policy resources and actions. See https://docs.turnkey.com/managing-policies/examples)
- `createSubOrganization` now uses `ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V4` under the hood, which utilizes wallets. The shape of the request has been updated to include the following parameter, `wallet`. Here's an example:

```js
{
  ...
  wallet: {
    walletName: "Default Wallet",
    accounts: [
      {
        curve: "CURVE_SECP256K1",
        pathFormat: "PATH_FORMAT_BIP32",
        path: "m/44'/60'/0'/0/0",
        addressFormat: "ADDRESS_FORMAT_ETHEREUM",
      },
    ],
  },
}
```

See https://docs.turnkey.com/concepts/sub-organizations for more details.

## 1.3.0

### Minor Changes

- Synced protos from mono
- Adds base URL check during initialization (closes https://github.com/tkhq/sdk/issues/124)
- The following are new features additions, fresh out the oven. Still getting them ready for primetime! Refreshed examples to come soon™️. Stay tuned and reach out to the Turnkey team if you have any questions.
  - Wallets:
    - 🟢 `ACTIVITY_TYPE_CREATE_WALLET` (via `/api/v1/submit/create_wallet`): create a HD wallet
    - 🟢 `ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS` (via `/api/v1/submit/create_wallet_accounts`): create a wallet account (address)
    - 🟢 `ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2` (via `/api/v1/submit/sign_raw_payload_v2`): sign a payload with a specified private key or address
    - 🟢 `ACTIVITY_TYPE_SIGN_TRANSACTION_V2` (via `/api/v1/submit/sign_transaction_v2`): sign a transaction with a specified private key or address
  - Organization features:
    - 🟢 `ACTIVITY_TYPE_SET_ORGANIZATION_FEATURE` (via `/api/v1/submit/set_organization_feature`): set an organization feature
    - 🟢 `ACTIVITY_TYPE_REMOVE_ORGANIZATION_FEATURE` (via `/api/v1/submit/remove_organization_feature`): remove an organization feature
    - Only one feature supported as of this time; additional documentation to follow.
  - Export private key:
    - 🟡 `ACTIVITY_TYPE_EXPORT_PRIVATE_KEY` (via `/api/v1/submit/export_private_key`): export a private key, encrypted to a target public key. We do not yet have CLI or front-end tooling to use this safely; stay tuned!
  - Email recovery:
    - 🟡 `ACTIVITY_TYPE_INIT_USER_EMAIL_RECOVERY` (via `/api/v1/submit/init_user_email_recovery`): initialize a new email recovery flow

Note:

- 🟢: good to go!
- 🟡: these endpoints are safe to use, but still experimental/unstable. Check back for updates and guidance.

### Patch Changes

- Updated dependencies
  - @turnkey/webauthn-stamper@0.2.0

## 1.2.0

### Minor Changes

- The `createSubOrganization` request has been updated under the hood:

  - Calling `.createSubOrganization` on our HTTP client will trigger an activity of type `CREATE_SUB_ORGANIZATION_V3` instead of `CREATE_SUB_ORGANIZATION_V2` previously.
  - If there are any policies referencing `CREATE_SUB_ORGANIZATION_V2` specifically, they will no longer work out of the box if creating sub-orgs via SDK. These policies will need to be updated to allow `CREATE_SUB_ORGANIZATION_V3`. See policy examples related to access control [here](https://docs.turnkey.com/managing-policies/examples#access-control) for additional methods of constructing policies.
  - `CREATE_SUB_ORGANIZATION_V3` supports everything `CREATE_SUB_ORGANIZATION_V2` supports, with the addition of a `privateKeys` field to atomically create a sub-org with private keys. If no private keys are desired, simply provide an empty array.
  - **NOTE**: when reading `createSubOrganization` results, SDK users will now need to look at `activity.result.createSubOrganizationResultV3` instead of the previously valid `activity.result.createSubOrganizationResult`.

## 1.1.1

### Patch Changes

- Updated dependencies
  - @turnkey/api-key-stamper@0.1.1

## 1.1.0

### Minor Changes

New exports:

- new `TurnkeyClient`. This is now the preferred interface to make Turnkey requests, because it supports both API keys and webauthn-signed requests. It also doesn't rely on global initialization
- new method to poll requests: `createActivityPoller`

Deprecation notices:

- deprecate `TurnkeyApi` (use `TurnkeyClient` instead), `init`, `browserInit` (no need for them anymore if you're using `TurnkeyClient`), and `withAsyncPolling` (use `createActivityPoller` instead)
- deprecate `SignedRequest` in favor of `TSignedRequest`. Besides the more correct name, `TSignedRequest` differs in its `stamp` property. It now stores the stamper header name as well as value, so users do not have to hardcode Turnkey stamp header names (e.g. "X-Stamp-Webauthn").

Update our swagger and generated files to latest versions:

- new endpoint to update users: `/public/v1/submit/update_user`
- pagination `limit` option has been updated to `string` instead of number for consistency with other pagination options

Signing is now performed through Turnkey stampers. New dependencies:

- @turnkey/webauthn-stamper@0.1.0
- @turnkey/api-key-stamper@0.1.0

## 1.0.1

### Patch Changes

- 8d1d0e8: Synced protos from mono

## 1.0.0

### Major Changes

- 46473ec: This breaking change updates generated code to be shorter and more intuitive to read:

  - generated fetchers do not include the HTTP method in their name. For example `useGetGetActivity` is now `useGetActivity`, and `usePostSignTransaction` is `useSignTransaction`.
  - input types follow the same convention (no HTTP method in the name): `TPostCreatePrivateKeysInput` is now `TCreatePrivateKeysInput`.
  - the "federated" request helpers introduced in `0.18.0` are now named "signed" requests to better reflect what they are. `FederatedRequest` is now `SignedRequest`, and generated types follow. For example: `federatedPostCreatePrivateKeys` is now `signCreatePrivateKeys`, `federatedGetGetActivity` is now `signGetActivity`, and so on.

  The name updates should be automatically suggested if you use VSCode since the new names are simply shorter versions of the old one.

### Patch Changes

- 38b424f: Sync public api types

## 0.18.1

### Patch Changes

- Synced protos from mono

## 0.18.0

### Minor Changes

- Add support for federated requests (an example is included under `sdk/examples/with-federated-passkeys`)
- Routine re-sync protos from mono

## 0.17.1

### Patch Changes

- Re-sync protos from mono. No public-facing changes.

## 0.17.0

### Minor Changes

- Added support for ed25519
- New endpoint to programmatically approve or reject activities (`/submit/approve_activity`, `/submit/reject_activity`)
- New endpoint to programmatically create authenticators (`/submit/create_authenticators`)
- New endpoints to update Private Key tags (`/submit/update_private_key_tag`)
- New endpoints to update User tags (`/submit/update_user_tag`)
- Simplified shape for `AuthenticatorParams` with a new `AuthenticatorParamsV2`. To take advantage of this new shape, use `ACTIVITY_TYPE_CREATE_USERS_V2` and the new `ACTIVITY_TYPE_CREATE_AUTHENTICATORS`.

## 0.16.0

### Minor Changes

- Fix `.postGetPrivateKey(...)`'s underlying path, while adding `@deprecated` `.postGetPrivateKeyBackwardsCompat(...)` for backward compatibility

## 0.15.0

### Minor Changes

- Export a new helper for offline request signing: `sealAndStampRequestBody(...)`.

## 0.14.0

### Minor Changes

- Updated the `addressFormats` enum field in `/submit/create_private_keys`

## 0.13.2

### Patch Changes

- New `TurnkeyRequestError` error class that contains rich error details

## 0.13.1

### Patch Changes

- Error messages now contain Turnkey-specific error details

## 0.13.0

### Minor Changes

- New `/submit/create_api_only_users` endpoint: `TurnkeyApi.postCreateApiOnlyUsers(...)`
- Marked `TurnkeyApi.postCreateUsers(...)` as deprecated
- Improved documentation on methods (via TSDoc)

## 0.12.0

### Minor Changes

- Error messages now contain Turnkey-specific error code and message

## 0.11.0

### Minor Changes

- New `/submit/create_users` endpoint: `TurnkeyApi.postCreateUsers(...)`

## 0.10.0

### Minor Changes

- No public-facing changes

## 0.9.0

### Minor Changes

- Improved support for React Native runtime (https://github.com/tkhq/sdk/pull/37)

## 0.8.1

### Patch Changes

- Switched from `undici` to `cross-fetch` to improve bundler compatibility

## 0.8.0

### Minor Changes

- Added browser runtime support — `@turnkey/http` is now a universal (isomorphic) package
- The API fetchers are now exported as namespace `TurnkeyApi`. `PublicApiService` has been marked as deprecated, but will remain functional until we hit v1.0.
- Dropped support for Node.js v14; we recommend using Node v18+

## 0.7.0

### Minor Changes

- Improved documentation
- Added `withAsyncPolling(...)` helper to provide built-in async polling support. Read more:
  - https://github.com/tkhq/sdk/tree/main/packages/http#withasyncpolling-helper

## 0.6.0

### Minor Changes

- Improved OpenAPI documentation

## 0.5.0

### Minor Changes

- Arbitrary message signing

## 0.4.0

### Minor Changes

- `timestamp` -> `timestampMs`

## 0.3.1

### Patch Changes

- Fix outdated artifact

## 0.3.0

### Minor Changes

- `keyId` -> `privateKeyId` everywhere

## 0.2.0

### Minor Changes

- Change parameter from `keyId` to `privateKeyId`
- Bump API version to latest Beta

## 0.1.3

### Patch Changes

- Support runtime config for credentials

## 0.1.2

### Patch Changes

- Drop internal dev dependency

## 0.1.1

### Patch Changes

- Initial release
- Updated dependencies
  - @turnkey/jest-config@0.1.1
