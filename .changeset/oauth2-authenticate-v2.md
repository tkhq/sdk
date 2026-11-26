---
"@turnkey/crypto": minor
"@turnkey/http": minor
"@turnkey/sdk-types": minor
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/core": minor
"@turnkey/react-wallet-kit": minor
"@turnkey/react-native-wallet-kit": minor
---

OAuth 2.0 authentication for X and Discord now encrypts the authorization code, PKCE verifier, redirect URI, and nonce to Turnkey's TLS Fetcher enclave, so neither the auth proxy nor the API sees them in plaintext. The React and React Native wallet kits use the new flow automatically.

- `exchangeOauth2Code` on the `@turnkey/core` client, the wallet kit providers, and the `@turnkey/sdk-server` API client exchanges an authorization code for a Turnkey OIDC token.
- Its failures use the new `TurnkeyErrorCodes.OAUTH2_AUTHENTICATE_ERROR`.
- `encryptOauth2ToBundle` in `@turnkey/crypto` verifies an `init_oauth2_authenticate` target and encrypts the inputs to it.
- `initOauth2Authenticate` and the auth proxy's `proxyInitOAuth2AuthenticateV2` and `proxyOAuth2AuthenticateV2` are new.
- Also syncs the latest public API: notification domains, static egress IPs for TVC apps, and external signer public keys on send transaction intents.

**Breaking:** the generated `oauth2Authenticate` API method (on `@turnkey/http`, `@turnkey/sdk-browser`, `@turnkey/sdk-server`, and the core `httpClient`) now submits `ACTIVITY_TYPE_OAUTH2_AUTHENTICATE_V2`, which takes an encrypted message in place of the plaintext inputs. Use `exchangeOauth2Code` instead.

Before:

```ts
const { oidcToken } = await turnkeyClient.apiClient().oauth2Authenticate({
  oauth2CredentialId,
  authCode,
  redirectUri,
  codeVerifier,
  nonce,
});
```

After:

```ts
const oidcToken = await turnkeyClient.apiClient().exchangeOauth2Code({
  oauth2CredentialId,
  provider: "OAUTH2_PROVIDER_X",
  clientId,
  authCode,
  redirectUri,
  codeVerifier,
  nonce,
});
```

The wallet kits no longer call the plaintext `proxyOAuth2Authenticate`. If you call it directly, replace `httpClient.proxyOAuth2Authenticate(...)` with `client.exchangeOauth2Code(...)`, which takes the same inputs and returns the OIDC token. The OAuth 2.0 credential for `clientId` must belong to the client's `organizationId`.
