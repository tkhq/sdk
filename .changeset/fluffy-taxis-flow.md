---
"@turnkey/crypto": patch
---

Fixed `decryptExportBundle` not working in some environments by adding a shim to handle `bs58`'s ESM-only export.
