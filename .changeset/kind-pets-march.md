---
"@turnkey/sdk-server": major
---

> ⚠️ **Policy warning:** `@turnkey/sdk-server` authenticates with an API key pair (public + private key from env). These changes introduce new activity types (`ACTIVITY_TYPE_INIT_OTP_V3`, `ACTIVITY_TYPE_VERIFY_OTP_V2`, `ACTIVITY_TYPE_OTP_LOGIN_V2`, `ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V8`, `ACTIVITY_TYPE_CREATE_OAUTH_PROVIDERS_V2`). If your policies target specific activity types, you must update them to allow the new versions. Generic resource/action policies are unaffected.
>
> **Specific policy (must update):**
>
> ```json
> {
>   "policyName": "Allow user <USER_ID> to init OTP",
>   "effect": "EFFECT_ALLOW",
>   "consensus": "approvers.any(user, user.id == '<YOUR_API_USER_ID>')",
>   "condition": "activity.type == 'ACTIVITY_TYPE_INIT_OTP_V2'"
> }
> ```
>
> ↑ Either update `ACTIVITY_TYPE_INIT_OTP_V2` → `ACTIVITY_TYPE_INIT_OTP_V3` (and similarly for the other activities), or switch to a generic resource/action policy to future-proof against version bumps.
>
> **Generic policy (no change needed):**
>
> ```json
> {
>   "policyName": "Allow user <USER_ID> to initiate and verify OTP activities",
>   "effect": "EFFECT_ALLOW",
>   "consensus": "approvers.any(user, user.id == '<YOUR_API_USER_ID>')",
>   "condition": "activity.resource in ['AUTH', 'OTP'] && activity.action in ['CREATE','VERIFY']"
> }
> ```

### `sendOtp` server action

**What changed:** `SendOtpResponse` now includes `otpEncryptionTargetBundle`.

```ts
// before
const { otpId } = await server.sendOtp({ ... });

// after
const { otpId, otpEncryptionTargetBundle } = await server.sendOtp({ ... });
```

---

### `verifyOtp` server action

**What changed:** `otpCode` replaced with `encryptedOtpBundle` in `VerifyOtpRequest`.

```ts
// before
await server.verifyOtp({
  otpId,
  otpCode: "123456",
  sessionLengthSeconds,
});

// after
import { encryptOtpCodeToBundle } from "@turnkey/crypto";

const encryptedOtpBundle = await encryptOtpCodeToBundle(
  otpCode, // the code the user entered
  otpEncryptionTargetBundle, // from the sendOtp response
  publicKey, // your target public key
);

await server.verifyOtp({
  otpId,
  encryptedOtpBundle,
  sessionLengthSeconds,
});
```

---

### `otpLogin` server action

**What changed:** `clientSignature` is now required in `OtpLoginRequest`.

```ts
// before
await server.otpLogin({
  suborgID,
  verificationToken,
  publicKey,
  sessionLengthSeconds,
});

// after
await server.otpLogin({
  suborgID,
  verificationToken,
  publicKey,
  clientSignature, // new — required
  sessionLengthSeconds,
});
```
