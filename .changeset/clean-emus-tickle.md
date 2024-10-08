---
"@turnkey/crypto": minor
---

Reorganize into two subparts:
- `crypto.ts`: core cryptography utilities
- `turnkey.ts`: Turnkey-specific cryptography utilities

Add `verifyStampSignature` method:
- See in-line code docs for more details + example of usage
- This is useful for checking the validity of a stamp (signature) against the request body
