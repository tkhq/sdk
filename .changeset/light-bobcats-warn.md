---
"@turnkey/react-native-wallet-kit": major
"@turnkey/react-wallet-kit": major
---

### `initOtp`

**What changed:** Now returns an `InitOtpResult` object instead of a plain `otpId` string.

```ts
// before
const otpId: string = await initOtp({
  otpType: OtpType.Email,
  contact: "user@example.com",
});

// after
const { otpId, otpEncryptionTargetBundle }: InitOtpResult = await initOtp({
  otpType: OtpType.Email,
  contact: "user@example.com",
});
```

---

### `verifyOtp`

**What changed:** Removed `contact` and `otpType` params. Added required `otpEncryptionTargetBundle`. The account lookup (`proxyGetAccount`) that previously happened inside `verifyOtp` has been moved out, so `verifyOtp` is now purely verification. Returns `verificationToken` and `publicKey` (removed `subOrganizationId`).

```ts
// before — verifyOtp also fetched the subOrganizationId internally
const { subOrganizationId, verificationToken } = await verifyOtp({
  otpId,
  otpCode,
  contact: "user@example.com",
  otpType: OtpType.Email,
});

// after — verification only; account lookup is separate
const { verificationToken, publicKey } = await verifyOtp({
  otpId,
  otpCode,
  otpEncryptionTargetBundle, // new — from initOtp
  publicKey,
});

// account lookup is now done separately (e.g. inside completeOtp)
const { organizationId: subOrgId } = await httpClient.proxyGetAccount({
  filterType: OtpTypeToFilterTypeMap[otpType],
  filterValue: contact,
  verificationToken,
});
```

---

### `loginWithOtp`

**What changed:** Removed `publicKey` param. The key bound during `verifyOtp` is now automatically reused as the session public key and used to produce the required `clientSignature`.

```ts
// before
await loginWithOtp({
  verificationToken,
  publicKey,
  invalidateExisting: true,
});

// after
await loginWithOtp({
  verificationToken,
  invalidateExisting: true,
});
```

---

### `signUpWithOtp`

**What changed:** Removed `publicKey` param. The key bound during `verifyOtp` is now automatically reused as the session public key and used to produce the required `clientSignature`.

```ts
// before
await signUpWithOtp({
  verificationToken,
  contact: "user@example.com",
  otpType: OtpType.Email,
  publicKey,
});

// after
await signUpWithOtp({
  verificationToken,
  contact: "user@example.com",
  otpType: OtpType.Email,
});
```
