---
"@turnkey/core": patch
---

Link the OAuth identity when an account is matched by verified email: completeOauth now logs in through the auth proxy's social-linking flow instead of failing with an unregistered identity
