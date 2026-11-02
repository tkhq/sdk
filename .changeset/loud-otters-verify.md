---
"@turnkey/crypto": major
"@turnkey/core": major
"@turnkey/sdk-types": major
"@turnkey/sdk-react": major
"@turnkey/react-wallet-kit": major
"@turnkey/react-native-wallet-kit": major
---

OTP now requires VerifyOtpV3 / SignupV3 verification tokens. Legacy OTP JWT claims (`id`, `public_key`, `contact`, `verification_type`) are no longer parsed. Use `VerificationToken.parse(jwt)` from `@turnkey/crypto` (then `token.verify()`) for the unified v1 claims shape shared with wallet auth.
