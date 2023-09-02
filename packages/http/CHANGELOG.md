# @turnkey/http

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
