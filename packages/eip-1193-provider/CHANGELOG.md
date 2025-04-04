# @turnkey/eip-1193-provider

## 3.3.4

### Patch Changes

- Updated dependencies [e501690]
  - @turnkey/sdk-browser@3.2.0

## 3.3.3

### Patch Changes

- Updated dependencies [bf87774]
  - @turnkey/sdk-browser@3.1.0

## 3.3.2

### Patch Changes

- Updated dependencies [5ec5187]
  - @turnkey/sdk-browser@3.0.1

## 3.3.1

### Patch Changes

- Updated dependencies [0e4e959]
- Updated dependencies [856f449]
- Updated dependencies [d4ce5fa]
- Updated dependencies [ecdb29a]
- Updated dependencies [72890f5]
  - @turnkey/sdk-browser@3.0.0
  - @turnkey/http@2.22.0

## 3.3.0

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

- Updated dependencies [93540e7]
- Updated dependencies [9147962]
  - @turnkey/sdk-browser@2.0.0

## 3.1.5

### Patch Changes

- Updated dependencies [233ae71]
  - @turnkey/sdk-browser@1.16.0

## 3.1.4

### Patch Changes

- Updated dependencies [56a307e]
  - @turnkey/sdk-browser@1.15.0
  - @turnkey/http@2.21.0

## 3.1.3

### Patch Changes

- Updated dependencies [3c44c4a]
  - @turnkey/sdk-browser@1.14.0
  - @turnkey/http@2.20.0

## 3.1.2

### Patch Changes

- Updated dependencies [69d2571]
- Updated dependencies [57f9cb0]
  - @turnkey/sdk-browser@1.13.0
  - @turnkey/http@2.19.0

## 3.1.1

### Patch Changes

- Updated dependencies [755833b]
  - @turnkey/sdk-browser@1.12.1

## 3.1.0

### Minor Changes

- 4945c71: Add support for @turnkey/sdk-browser clients

### Patch Changes

- Updated dependencies [6695af2]
  - @turnkey/sdk-browser@1.12.0
  - @turnkey/http@2.18.0

## 3.0.5

### Patch Changes

- Updated dependencies [053fbfb]
  - @turnkey/http@2.17.3

## 3.0.4

### Patch Changes

- @turnkey/http@2.17.2

## 3.0.3

### Patch Changes

- Updated dependencies [538d4fc]
  - @turnkey/http@2.17.1

## 3.0.2

### Patch Changes

- Updated dependencies [78bc39c]
  - @turnkey/http@2.17.0

## 3.0.1

### Patch Changes

- Updated dependencies [4df8914]
  - @turnkey/http@2.16.0

## 3.0.0

### Patch Changes

- 9c056d0: fix: personal_sign parameters
- Updated dependencies [9ebd062]
  - @turnkey/http@2.15.0

## 2.0.8

### Patch Changes

- Updated dependencies [96d7f99]
  - @turnkey/http@2.14.2

## 2.0.7

### Patch Changes

- Updated dependencies [ff059d5]
  - @turnkey/http@2.14.1

## 2.0.6

### Patch Changes

- Updated dependencies [848f8d3]
  - @turnkey/http@2.14.0

## 2.0.5

### Patch Changes

- Updated dependencies [93dee46]
  - @turnkey/http@2.13.0

## 2.0.4

### Patch Changes

- Updated dependencies [e2f2e0b]
  - @turnkey/http@2.12.3

## 2.0.3

### Patch Changes

- Removes unused VERSION from constants. Fixes issue with using process in a browser environment.

## 2.0.2

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.2

## 2.0.1

### Patch Changes

- Updated dependencies [f17a229]
  - @turnkey/http@2.12.1

## 2.0.0

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.12.0

## 1.0.0

### Patch Changes

- Updated dependencies
  - @turnkey/http@2.11.0

## 0.2.0

### Minor Changes

- 65f781b: Initial Release

## 0.1.0

Initial release!
