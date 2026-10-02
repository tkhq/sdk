---
"@turnkey/core": patch
"@turnkey/react-wallet-kit": patch
"@turnkey/sdk-react": patch
---

Bind first-party OTP login and signup client signatures to the complete request semantics while preserving the legacy signature helpers.

The matching mono verifier must be deployed before releasing these SDK versions. This is a server-first rollout; clients do not probe, fall back, or submit dual signatures.
