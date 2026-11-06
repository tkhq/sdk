---
"@turnkey/crypto": major
"@turnkey/core": major
"@turnkey/sdk-types": major
"@turnkey/sdk-react": major
"@turnkey/react-wallet-kit": major
"@turnkey/react-native-wallet-kit": major
---

OTP now requires VerifyOtpV3 / SignupV3 verification tokens. Legacy OTP JWT claims (`id`, `public_key`, `contact`, `verification_type`) are no longer parsed. Use `VerificationToken.parse(jwt)` from `@turnkey/crypto` (then `token.verify()`) for the unified v1 claims shape shared with wallet auth.

SignupV3 requires `ClientSignatureV2`: every OTP, wallet, and OIDC token's ephemeral P-256 key must sign the same `signupV3` payload. OTP contacts live on `otpAuthenticators` (contact, otpType, verificationToken) instead of top-level email, phone, or verification token. `.sign(signFn, stamper.listKeyPairs())` matches each authenticator token to a listed key by nonce. Sign via `ClientSignature` in `@turnkey/crypto`: `new ClientSignature.RootUserParamsV6(params).sign(signFn, stamper.listKeyPairs())` for `createSubOrganization`, or `new ClientSignature.ProxyTSignupV3Body(body).sign(signFn, stamper.listKeyPairs())` for auth-proxy SignupV3.
Login no longer uses client signatures in core / react-wallet-kit; `getClientSignatureMessageForLogin` remains for custom-server OTP login through `OtpLoginV2`.
