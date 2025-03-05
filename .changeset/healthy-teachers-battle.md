---
"@turnkey/sdk-react-native": major
---

This breaking change adds support for multiple sessions:

- The concept of a **selected session** has been introduced:
  - Users can switch between sessions using `setSelectedSession({ sessionKey: <key> })`.
  - The selected session determines the active `client`, `user`, and `session` state.
  - API calls such as `updateUser`, `createWallet`, and `signRawPayload` now apply to the selected session.
- A session limit of **15 active sessions** has been enforced:
  - If the limit is reached, users must remove an existing session before creating a new one.
  - Expired or invalid sessions are automatically cleaned up.
