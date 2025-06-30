---
"@turnkey/crypto": patch
---

Fixed `decryptCredentialBundle` not working in React Native by adding a shim to handle `bs58check`'s ESM-only export.
