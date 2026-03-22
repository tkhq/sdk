---
"@turnkey/sdk-browser": major
"@turnkey/sdk-server": major
"@turnkey/core": major
"@turnkey/sdk-types": major
"@turnkey/http": major
---

### `INIT_OTP`

`ACTIVITY_TYPE_INIT_OTP_V2` → `ACTIVITY_TYPE_INIT_OTP_V3`

**What changed:** Added required `otpEncryptionTargetBundle` to the result.

```ts
// before — v1InitOtpResult
{
  otpId: string;
}

// after — v1InitOtpResultV2
{
  otpId: string;
  otpEncryptionTargetBundle: string; // new
}
```

---

### `VERIFY_OTP`

`ACTIVITY_TYPE_VERIFY_OTP` → `ACTIVITY_TYPE_VERIFY_OTP_V2`

**What changed:** Replaced plaintext `otpCode` + `publicKey` with an `encryptedOtpBundle`.

`encryptedOtpBundle` is an HPKE-encrypted `{ otp_code, public_key }` payload, encrypted to the enclave's target public key from `otpEncryptionTargetBundle` (returned by `initOtp`). This way the OTP code never leaves the client in plaintext.

```ts
// before — v1VerifyOtpIntent
{
  otpId: string;
  otpCode: string;           // removed
  expirationSeconds?: string;
  publicKey?: string;         // removed
}

// after — v1VerifyOtpIntentV2
{
  otpId: string;
  encryptedOtpBundle: string; // new — replaces otpCode + publicKey
  expirationSeconds?: string;
}
```

---

### `OTP_LOGIN`

`ACTIVITY_TYPE_OTP_LOGIN` → `ACTIVITY_TYPE_OTP_LOGIN_V2`

**What changed:** `clientSignature` promoted from optional to required.

```ts
// before — v1OtpLoginIntent
{
  verificationToken: string;
  publicKey: string;
  expirationSeconds?: string;
  invalidateExisting?: boolean;
  clientSignature?: v1ClientSignature; // optional
}

// after — v1OtpLoginIntentV2
{
  verificationToken: string;
  publicKey: string;
  expirationSeconds?: string;
  invalidateExisting?: boolean;
  clientSignature: v1ClientSignature;  // now required
}
```

---

### `CREATE_OAUTH_PROVIDERS`

`ACTIVITY_TYPE_CREATE_OAUTH_PROVIDERS` → `ACTIVITY_TYPE_CREATE_OAUTH_PROVIDERS_V2`

**What changed:** `oidcToken` and `oidcClaims` are now a oneOf union — you must provide exactly one.

```ts
// before — v1OauthProviderParams
{
  providerName: string;
  oidcToken: string;
}

// after — v1OauthProviderParamsV2
{
  providerName: string;
} & (
  | { oidcToken: string }
  | { oidcClaims: { iss: string; sub: string; aud: string } }
)
```

---

### `CREATE_SUB_ORGANIZATION`

`ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V7` → `ACTIVITY_TYPE_CREATE_SUB_ORGANIZATION_V8`

**What changed:** `rootUsers` items updated from `v1RootUserParamsV4` → `v1RootUserParamsV5`, which updates `oauthProviders` from `v1OauthProviderParams` → `v1OauthProviderParamsV2`.

```ts
// before — v1RootUserParamsV4
{
  userName: string;
  userEmail?: string;
  userPhoneNumber?: string;
  apiKeys: v1ApiKeyParamsV2[];
  authenticators: v1AuthenticatorParamsV2[];
  oauthProviders: {              // v1OauthProviderParams
    providerName: string;
    oidcToken: string;           // was required
  }[];
}

// after — v1RootUserParamsV5
{
  userName: string;
  userEmail?: string;
  userPhoneNumber?: string;
  apiKeys: v1ApiKeyParamsV2[];
  authenticators: v1AuthenticatorParamsV2[];
  oauthProviders: ({             // v1OauthProviderParamsV2
    providerName: string;
  } & (
    | { oidcToken: string }
    | { oidcClaims: { iss: string; sub: string; aud: string } }
  ))[];
}
```

---

### `CREATE_USERS`

`ACTIVITY_TYPE_CREATE_USERS_V3` → `ACTIVITY_TYPE_CREATE_USERS_V4`

**What changed:** `users` items updated from `v1UserParamsV3` → `v1UserParamsV4`, which updates `oauthProviders` from `v1OauthProviderParams` → `v1OauthProviderParamsV2`.

```ts
// before — v1UserParamsV3
{
  userName: string;
  userEmail?: string;
  userPhoneNumber?: string;
  apiKeys: v1ApiKeyParamsV2[];
  authenticators: v1AuthenticatorParamsV2[];
  oauthProviders: {              // v1OauthProviderParams
    providerName: string;
    oidcToken: string;           // was required
  }[];
  userTags: string[];
}

// after — v1UserParamsV4
{
  userName: string;
  userEmail?: string;
  userPhoneNumber?: string;
  apiKeys: v1ApiKeyParamsV2[];
  authenticators: v1AuthenticatorParamsV2[];
  oauthProviders: ({             // v1OauthProviderParamsV2
    providerName: string;
  } & (
    | { oidcToken: string }
    | { oidcClaims: { iss: string; sub: string; aud: string } }
  ))[];
  userTags: string[];
}
```
