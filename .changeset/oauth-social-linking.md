---
"@turnkey/core": patch
---

Fix a bug where signing in with Google failed for an account that had signed up with email OTP. `completeOauth` now completes the social-linking flow through the auth proxy instead of attempting a stamped login with an identity that was never registered on the sub-organization.
