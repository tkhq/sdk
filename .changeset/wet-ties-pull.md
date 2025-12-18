---
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/http": minor
---

Update as per mono v2025.12.3.

### Behavioral Changes

- `appName` is now **required**:
  - In `emailCustomization` for Email Auth activities
  - At the top-level intent for OTP activities
- Auth proxy endpoints are **not affected**

### Activity Version Bumps

The following activity types have been versioned:

- `ACTIVITY_TYPE_INIT_OTP` → `ACTIVITY_TYPE_INIT_OTP_V2`
- `ACTIVITY_TYPE_INIT_OTP_AUTH_V2` → `ACTIVITY_TYPE_INIT_OTP_V3`
- `ACTIVITY_TYPE_EMAIL_AUTH_V2` → `ACTIVITY_TYPE_EMAIL_AUTH_V3`
- `ACTIVITY_TYPE_INIT_USER_EMAIL_RECOVERY` -> `ACTIVITY_TYPE_INIT_USER_EMAIL_RECOVERY_V2`
