---
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": major
"@turnkey/core": major
"@turnkey/sdk-types": minor
"@turnkey/http": minor
---

## End-to-end encrypted OTP

The OTP flow is now encrypted end-to-end. OTP codes never leave the client unencrypted — they are encrypted to Turnkey's secure enclaves before submission. Login and signup now require a `clientSignature` proving possession of the session private key.

### What changed

- `InitOtp` now returns `{ otpId, otpEncryptionTargetBundle }` (previously just `{ otpId }`)
- `VerifyOtp` now takes `encryptedOtpBundle` instead of a plaintext `otpCode`
- `OtpLogin` now **requires** a `clientSignature` (previously optional)
- `SecuritySettings` gains `socialLinkingClientIds`: OAuth client IDs whitelisted for social account linking

Activity type updates:

- `ACTIVITY_TYPE_INIT_OTP_V2` → `ACTIVITY_TYPE_INIT_OTP_V3`
- `ACTIVITY_TYPE_VERIFY_OTP` → `ACTIVITY_TYPE_VERIFY_OTP_V2`
- `ACTIVITY_TYPE_OTP_LOGIN` → `ACTIVITY_TYPE_OTP_LOGIN_V2`

---

## Migration Guide

### If you use `@turnkey/react-wallet-kit` or `@turnkey/sdk-react`

The `Auth` component handles the encrypted OTP flow internally — **no code changes needed** for most users.

If you use the `OtpVerification` component directly, it now requires an `otpEncryptionTargetBundle` prop:

```tsx
// Before
<OtpVerification
  type={OtpType.Email}
  contact={email}
  otpId={otpId}
  onValidateSuccess={handleSuccess}
  onResendCode={handleResend}
/>

// After
<OtpVerification
  type={OtpType.Email}
  contact={email}
  otpId={otpId}
  otpEncryptionTargetBundle={otpEncryptionTargetBundle}
  onValidateSuccess={handleSuccess}
  onResendCode={handleResend}
/>
```

The `otpEncryptionTargetBundle` comes from the `sendOtp()` response alongside `otpId`.

### If you use `@turnkey/core` directly

The high-level `completeOtp()` method handles encryption and signing internally. If you call `verifyOtp()` / `loginWithOtp()` / `signUpWithOtp()` individually, here's the new flow:

#### Step 1: Init OTP (response shape changed)

```typescript
// Before
const { otpId } = await client.initOtp({ otpType, contact });

// After — response now includes the encryption target bundle
const { otpId, otpEncryptionTargetBundle } = await client.initOtp({
  otpType,
  contact,
});
```

#### Step 2: Encrypt & verify OTP (replaces plaintext submission)

```typescript
import { encryptToEnclave, generateP256KeyPair } from "@turnkey/crypto";
import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
} from "@turnkey/encoding";

// Parse the encryption target bundle
const targetBundle = JSON.parse(otpEncryptionTargetBundle);
const targetData = JSON.parse(
  new TextDecoder().decode(uint8ArrayFromHexString(targetBundle.data)),
);

// Encrypt OTP code + your session public key to the enclave
const payload = JSON.stringify({ otpCode: code.trim(), publicKey });
const encrypted = await encryptToEnclave(targetData.targetPublic, payload);
const encryptedOtpBundle = uint8ArrayToHexString(encrypted);

// Before
const { verificationToken } = await client.verifyOtp({
  otpId,
  otpCode: "123456",
});

// After
const { verificationToken } = await client.verifyOtp({
  otpId,
  encryptedOtpBundle,
});
```

#### Step 3: Build client signature & login (signature now required)

```typescript
import { getClientSignatureMessageForLogin } from "@turnkey/core";
import { sha256 } from "@noble/hashes/sha256";
import { p256 } from "@noble/curves/p256";

const { message, publicKey: signingPublicKey } =
  getClientSignatureMessageForLogin({
    verificationToken,
    sessionPublicKey: publicKey,
  });

const messageHash = sha256(new TextEncoder().encode(message));
const signature = p256.sign(messageHash, uint8ArrayFromHexString(privateKey));

const clientSignature = {
  scheme: "CLIENT_SIGNATURE_SCHEME_API_P256" as const,
  publicKey: signingPublicKey,
  message,
  signature: signature.toCompactHex(),
};

// Before
await client.loginWithOtp({ verificationToken, publicKey });

// After — clientSignature is required
await client.loginWithOtp({ verificationToken, publicKey, clientSignature });
```

### If you use `@turnkey/sdk-server`

Server-side types have been updated to match the new encrypted flow:

```typescript
// sendOtp response now includes the encryption target bundle
const { otpId, otpEncryptionTargetBundle } = await server.sendOtp({
  appName: "My App",
  otpType: OtpType.Email,
  contact: email,
  userIdentifier: publicKey,
});
// Pass otpEncryptionTargetBundle to your client for encryption

// verifyOtp now takes encryptedOtpBundle instead of otpCode
// Before
await server.verifyOtp({ otpId, otpCode: "123456" });
// After
await server.verifyOtp({ otpId, encryptedOtpBundle });

// otpLogin now requires clientSignature
// Before
await server.otpLogin({ suborgID, verificationToken, publicKey });
// After
await server.otpLogin({
  suborgID,
  verificationToken,
  publicKey,
  clientSignature,
});
```

### If you use `@turnkey/sdk-browser`

The generated client methods now use V2/V3 activity types. The input shapes mirror the changes above — `encryptedOtpBundle` replaces `otpCode` in `verifyOtp`, and `clientSignature` is required for `otpLogin`.

### `@turnkey/sdk-types` and `@turnkey/http` (minor)

Updated generated types to include the new activity types and request/response shapes. No breaking changes — new types are additive.
