---
"@turnkey/viem": minor
---

- Add implementation for `sign`. This is primarily applicable for account abstraction use cases.
- Enforce message hashing at an abstracted level.
- Minor bugfixes: pass through payload encoding; enforce default value for `to` parameter (abstracted away from user -- non-breaking)
