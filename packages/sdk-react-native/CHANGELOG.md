# @turnkey/sdk-react-native

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
