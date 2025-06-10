# @turnkey/eip-1193-provider

## 3.3.12

### Patch Changes

- [#665](https://github.com/tkhq/sdk/pull/665) [`be0a621`](https://github.com/tkhq/sdk/commit/be0a621fb962bd51d2df1a1e79f5260d7c696772) Author [@amircheikh](https://github.com/amircheikh) - Fix for `no runner registered` error when using mismatched versions of turnkey/http

- Updated dependencies [[`be0a621`](https://github.com/tkhq/sdk/commit/be0a621fb962bd51d2df1a1e79f5260d7c696772)]:
  - @turnkey/http@3.4.2
  - @turnkey/sdk-browser@5.2.1

## 3.3.11

### Patch Changes

- Updated dependencies [[`5afbe51`](https://github.com/tkhq/sdk/commit/5afbe51949bdd1997fad083a4c1e4272ff7409dc), [`40c4035`](https://github.com/tkhq/sdk/commit/40c40359ec7096d0bca39ffc93e89361b3b11a1a), [`593de2d`](https://github.com/tkhq/sdk/commit/593de2d9404ec8cf53426f9cf832c13eefa3fbf2)]:
  - @turnkey/sdk-browser@5.2.0
  - @turnkey/http@3.4.1
  - @turnkey/api-key-stamper@0.4.6

## 3.3.10

### Patch Changes

- Updated dependencies [[`27fe590`](https://github.com/tkhq/sdk/commit/27fe590cdc3eb6a8cde093eeefda2ee1cdc79412)]:
  - @turnkey/sdk-browser@5.1.0

## 3.3.9

### Patch Changes

- Updated dependencies [[`07dfd33`](https://github.com/tkhq/sdk/commit/07dfd3397472687092e1c73b1d68714f421b9ca0)]:
  - @turnkey/sdk-browser@5.0.0
  - @turnkey/http@3.4.0

## 3.3.8

### Patch Changes

- Updated dependencies [25ca339]
  - @turnkey/sdk-browser@4.3.0
  - @turnkey/http@3.3.0

## 3.3.7

### Patch Changes

- Updated dependencies [3f6e415]
- Updated dependencies [4d1d775]
  - @turnkey/sdk-browser@4.2.0
  - @turnkey/http@3.2.0
  - @turnkey/api-key-stamper@0.4.5

## 3.3.6

### Patch Changes

- Updated dependencies [3e4a482]
  - @turnkey/sdk-browser@4.1.0
  - @turnkey/http@3.1.0

## 3.3.5

### Patch Changes

- 7a89040: Fix type resolution

## 3.3.4

### Patch Changes

- Updated dependencies [e501690]
- Updated dependencies [d1083bd]
- Updated dependencies [f94d36e]
  - @turnkey/sdk-browser@4.0.0
  - @turnkey/http@3.0.0

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
