---
"@turnkey/core": minor
---

### Attested stamping

Add `AttestedStamper` and `overrideAttestedStamper()` to the HTTP client. OTP and OAuth login flows now use `stampLogin` with an attested stamp (`X-Stamp-Attested`) instead of the proxy-specific `proxyOtpLoginV2` / `proxyOAuthLogin` endpoints. A new `StamperType.Attested` enum value is available for attested stamp selection.

### Session profiles

Add session profile support for creating scoped sessions. Auth methods now accept an optional `sessionProfileId` parameter to restrict a session's permissions to those defined by the profile: `loginWithPasskey`, `signUpWithPasskey`, `buildWalletLoginRequest`, `loginWithWallet`, `signUpWithWallet`, `loginOrSignupWithWallet`, `loginWithOtp`, `signUpWithOtp`, `completeOtp`, `loginWithOauth`, `signUpWithOauth`, and `completeOauth`. The `Session` type adds `sessionProfileId` and `scope` fields.

### MFA handling

Add MFA support in the SDK. A new `onMfaRequired` callback can be provided to `TurnkeyHttpClientConfig` and `TurnkeySDKClientConfig`. When an activity returns `ACTIVITY_STATUS_AUTHENTICATORS_NEEDED` or `ACTIVITY_STATUS_CONSENSUS_NEEDED`, the client automatically fetches MFA statuses via `getMfaStatus`, invokes the callback with an `MfaContext`, and re-polls for completion after the callback resolves. Add `ActivityStatus` enum to `@turnkey/sdk-types` and include `ACTIVITY_STATUS_AUTHENTICATORS_NEEDED` in `TERMINAL_ACTIVITY_STATUSES`.
