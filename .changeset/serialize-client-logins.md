---
"@turnkey/core": patch
---

Logins and signups on a client now run one at a time, including complete authentication flows and session refreshes. Concurrent calls wait for the previous attempt to finish, even if it fails.
