---
"@turnkey/react-native-wallet-kit": minor
---

### Attested stamping

Add attested stamping support. Expose `overrideAttestedStamper()` on the provider context. OTP verification and OAuth flows now automatically configure the attested stamper with the verification token or OIDC token. OTP and OAuth login flows use `stampLogin` with an attested stamp (`X-Stamp-Attested`) instead of the proxy-specific `proxyOtpLoginV2` / `proxyOAuthLogin` endpoints.

### Session profiles

Add session profile support for creating scoped sessions. Auth methods now accept an optional `sessionProfileId` parameter to restrict a session's permissions to those defined by the profile: `loginWithPasskey`, `signUpWithPasskey`, `buildWalletLoginRequest`, `loginWithWallet`, `signUpWithWallet`, `loginOrSignupWithWallet`, `loginWithOtp`, `signUpWithOtp`, `completeOtp`, `loginWithOauth`, `signUpWithOauth`, and `completeOauth`.

### MFA handling

Add MFA support. Expose `setMfaHandler` on the provider context, a ref-based function that lets you register or clear a custom MFA handler at any point during the component lifecycle. When set, the handler is invoked with an `MfaContext` whenever an activity requires multi-factor approval (`ACTIVITY_STATUS_AUTHENTICATORS_NEEDED` or `ACTIVITY_STATUS_CONSENSUS_NEEDED`). The client automatically fetches MFA statuses via `getMfaStatus` and re-polls for completion after the handler resolves. Pass `undefined` to clear the handler and restore the default behavior.
