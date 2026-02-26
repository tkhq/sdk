---
"@turnkey/sdk-browser": minor
"@turnkey/sdk-server": minor
"@turnkey/sdk-types": minor
"@turnkey/core": minor
"@turnkey/http": minor
---

Mono sync per v2026.2.8

The OTP flow is now encrypted end-to-end: `InitOtp` returns an `otpEncryptionTargetBundle`, and `VerifyOtp` now takes an `encryptedOtpBundle` instead of a plaintext `otpCode`. `OtpLogin` now requires a `clientSignature`.

Here are the relevant activity updates:

- `ACTIVITY_TYPE_INIT_OTP_V2` --> `ACTIVITY_TYPE_INIT_OTP_V3`
- `ACTIVITY_TYPE_VERIFY_OTP` --> `ACTIVITY_TYPE_VERIFY_OTP_V2`
- `ACTIVITY_TYPE_OTP_LOGIN` --> `ACTIVITY_TYPE_OTP_LOGIN_V2`

SecuritySettings gains `socialLinkingClientIds`: OAuth client IDs whitelisted for social account linking
