---
"@turnkey/core": patch
---

`loginWithOtp` and `loginWithOauth` now stamp their `stampLogin` request, activity polling and MFA status requests with an attested stamper that only that login uses. A concurrent login or `overrideAttestedStamper` call no longer changes the identity these requests are stamped with. Both methods still configure the shared attested stamper, as before. `AttestedStamper.stamp()` now reads its configuration once, before it signs. Logins no longer go through `client.httpClient`; they use a per-login client built on its config.
