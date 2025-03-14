# @turnkey/sdk-server

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
