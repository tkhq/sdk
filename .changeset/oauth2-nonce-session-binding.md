---
"@turnkey/crypto": minor
"@turnkey/sdk-types": minor
"@turnkey/react-wallet-kit": minor
---

Add client-side support for the OAuth2 encrypted session binding. This cryptographically binds the session public key and PKCE code verifier together, encrypted to the TLS Fetcher quorum key, to prevent a malicious relay from substituting the OAuth nonce. `@turnkey/crypto` exports a new `encryptOauthSessionBinding` helper, `@turnkey/sdk-types` adds the optional `encryptedSessionBinding` field to the OAuth2 authenticate request types, and `@turnkey/react-wallet-kit`'s Discord and X OAuth flows now generate and send this binding. Plaintext `nonce` and `codeVerifier` are still sent for backward compatibility with servers that haven't been updated yet.
