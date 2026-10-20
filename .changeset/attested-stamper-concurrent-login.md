---
"@turnkey/core": patch
---

Concurrent `loginWithOtp` and `loginWithOauth` calls on one client now run their `stampLogin` request one at a time, so each request is stamped with the identity of its own login. `AttestedStamper.stamp()` now reads its configuration once, before it signs, so a concurrent `configure()` or `clear()` cannot change the stamp it is building.
