---
"@turnkey/crypto": patch
---

- Removed `@peculiar/webcrypto` dependancy. This will fix build errors in environments where `webcrypto` is not defined but will still require a polyfill if you use a function where `webcrypto` is required.
