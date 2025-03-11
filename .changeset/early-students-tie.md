---
"@turnkey/eip-1193-provider": minor
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": minor
"@turnkey/sdk-react": minor
---

## Major Package Updates

### @turnkey/sdk-browser

- create abstract `TurnkeyBaseClient` class which extends `TurnkeySDKClientBase`
  - `TurnkeyBrowserClient`, `TurnkeyIframeClient`, `TurnkeyPasskeyClient`, and `TurnkeyWalletClient` all extend `TurnkeyBaseClient`
- TurnkeyBrowserClient
  - Session Management
    - refreshSession
    - loginWithBundle
    - loginWithPasskey
    - loginWithSession
- TurnkeyPasskeyClient
  - Session Management
    - createPasskeySession

## Minor Package Updates

### @turnkey/sdk-react

- update `TurnkeyContext` to use new `.getSession()` method to check if there is an active session
- `OTPVerification` component no longer receives `authIframeClient` or `onValidateSuccess` props

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
