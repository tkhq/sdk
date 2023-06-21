# @turnkey/http

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
