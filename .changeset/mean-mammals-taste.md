---
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
"@turnkey/react-native-wallet-kit": minor
---

Added `signWithApiKey()` which allows users to sign arbitrary messages using the API key stamper.

`addOauthProvider` now accepts a list of `oidcClaims` and the `oidcToken` parameter is now optional. This means the function can now be called with either an `oidcToken`, a list of `oidcClaims` or both.

An `oidcClaims` entry is the `{ iss, sub, aud }` triple from an OIDC token - `iss` and `sub` identify the user and `aud` is the client ID the token was issued for. Passing them lets you register additional audiences (e.g. iOS bundle ID + web client ID) against the same identity without needing a separate token for each, so a single user can sign in from any of them and resolve to the same sub-organization.
