---
"@turnkey/eip-1193-provider": minor
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": minor
"@turnkey/sdk-react": major
---

## Major Package Updates

### @turnkey/sdk-browser

- create abstract `TurnkeyBaseClient` class which extends `TurnkeySDKClientBase`
  - `TurnkeyBrowserClient`, `TurnkeyIframeClient`, `TurnkeyPasskeyClient`, and `TurnkeyWalletClient` all extend `TurnkeyBaseClient`
- TurnkeyBrowserClient
  - Session Management
    - refreshSession - attempts to refresh an existing session and will extend the session expiry using the expirationSeconds parameter
    - loginWithBundle - authenticate a user via a credential bundle and creates a session
    - loginWithPasskey - attempts to authenticate a user via passkey and create a read-only or read-write session
    - loginWithSession - takes a `Session` created via a server action and attempts to authenticate the user
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

- add dependencies
  - `"@turnkey/api-key-stamper": "workspace:*"`
  - `"@turnkey/http": "workspace:*"`
  - `"@turnkey/sdk-browser": "workspace:*"`
- specify TypeScript version ^5.1.5
