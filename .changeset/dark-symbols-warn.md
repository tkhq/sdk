---
"@turnkey/core": patch
---

- added optional `organizationId` to `loginWithOAuth()`
- added optional `invalidateExisting` to `signUpWithOAuth()`
- fixed `invalidateExisting` being ignored in `completeOAuth()` during signup
