---
"@turnkey/react-wallet-kit": minor
---

- Added config option to disable managed state auto refreshing.
- The session state is automatically cleared if a request to Turnkey returns an unauthorized error indicating that the session keypair is no longer valid.
