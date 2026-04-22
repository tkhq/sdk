---
"@turnkey/sdk-react": major
---

### `OtpVerification`

**What changed:** New required prop `otpEncryptionTargetBundle`

`otpEncryptionTargetBundle` comes from the `sendOtp` response:

```ts
const { otpId, otpEncryptionTargetBundle } = await server.sendOtp({
  appName: "Example App",
  otpType: OtpType.Sms,
  contact: phoneInput,
  customSmsMessage: "Your OTP is {{.OtpCode}}",
  userIdentifier: publicKey,
});
```

```tsx
// before
<OtpVerification
  type={type}
  contact={contact}
  otpId={otpId}
  // ...
/>

// after
<OtpVerification
  type={type}
  contact={contact}
  otpId={otpId}
  otpEncryptionTargetBundle={otpEncryptionTargetBundle} // new
  // ...
/>
```
