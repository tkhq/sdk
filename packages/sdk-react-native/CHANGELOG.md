# @turnkey/sdk-react-native

## 1.1.0

### Minor Changes

- e8bc05b: Introduces handleGoogleOAuth(): Adds a utility function to handle the Google OAuth authentication flow in React Native.

**Usage Summary**:  
`handleGoogleOAuth` launches an InAppBrowser to initiate the OAuth flow using your client ID, nonce, and app scheme. After a successful login, it extracts the `oidcToken` from the redirect URL and calls your `onSuccess` callback with the token.

```ts
handleGoogleOAuth({
  clientId: string,           // Google OAuth client ID
  nonce: string,              // Random nonce
  scheme: string,             // App’s custom URL scheme (e.g., "myapp")
  originUri?: string,         // Optional custom origin URI - defaults to Turnkey proxies
  redirectUri?: string,       // Optional custom redirect URI - defaults to Turnkey proxies
  onSuccess: (oidcToken: string) => void, // Called with token on success
});
```

## 1.0.5

### Patch Changes

- 3b5b360: - Adds optional parameter for createEmbeddedKey():
  - You can now pass a sessionKey to createEmbeddedKey() to generate separate embedded keys for different sessions, which is helpful when running multiple authentication flows concurrently.
  - Introduces onSessionExpiryWarning():
    - You can now add a callback via the provider config that triggers 15 seconds before a session expires.
  - Introduces refreshSession():
    - You now can refresh an active session that is about to expire.

## 1.0.4

### Patch Changes

- Updated dependencies [d1083bd]
- Updated dependencies [f94d36e]
  - @turnkey/http@3.0.0
  - @turnkey/crypto@2.3.1

## 1.0.3

### Minor Changes

- a7e7de0: Fixed compatibility issue with `@turnkey/viem`

## 1.0.2

### Patch Changes

- Updated dependencies [ecdb29a]
  - @turnkey/http@2.22.0
  - @turnkey/crypto@2.3.1

## 1.0.1

### Patch Changes

- Updated dependencies [56a307e]
  - @turnkey/http@2.21.0
  - @turnkey/crypto@2.3.1

## 1.0.0

### Major Changes

- fcf9503: This breaking change adds support for multiple sessions:

  - The concept of a **selected session** has been introduced:
    - Users can switch between sessions using `setSelectedSession({ sessionKey: <key> })`.
    - The selected session determines the active `client`, `user`, and `session` state.
    - API calls such as `updateUser`, `createWallet`, and `signRawPayload` now apply to the selected session.
  - A session limit of **15 active sessions** has been enforced:
    - If the limit is reached, users must remove an existing session before creating a new one.
    - Expired or invalid sessions are automatically cleaned up.

## 0.1.1

### Patch Changes

- Updated dependencies [3c44c4a]
  - @turnkey/http@2.20.0
  - @turnkey/crypto@2.3.1
