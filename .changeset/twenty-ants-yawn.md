---
"@turnkey/sdk-server": patch
---

Remove unused Next.js dependency
- while the `"use server"` directive in `actions.ts` is to be used specifically with Next, removing it from this package (`@turnkey/sdk-server`) is fine, though applications *using* this package will need Next.js
