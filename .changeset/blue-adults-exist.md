---
"@turnkey/sdk-browser": major
"@turnkey/sdk-react": major
---

## @turnkey/sdk-browser

the following SDK Browser client authentication methods will now return the `ActiveSession`

`refreshSession()`
`loginWithBundle()`
`loginWithSession()`
`loginWithPasskey()`
`loginWithWallet()`
`loginWithReadWriteSession()`
`loginWithAuthBundle()`

the `ActiveSession` type contains the following information:

```ts
export type ActiveSession = {
  session: Session;
  client: AuthClient;
};

/**
 * The type of AuthClient used to authenticate the user.
 */
export enum AuthClient {
  Passkey = "passkey",
  Wallet = "wallet",
  Iframe = "iframe",
}

export enum SessionType {
  READ_ONLY = "SESSION_TYPE_READ_ONLY",
  READ_WRITE = "SESSION_TYPE_READ_WRITE",
}

export type Session = {
  sessionType: SessionType;
  userId: string;
  username?: string;
  organizationId: string;
  organizationName?: string;
  expiry: number; // Unix timestamp representing the expiry of the session set by the server
  token: string; // credentialBundle (read-write) or read token
};
```

## @turnkey/sdk-react

Updated OTP Verification components to default to a numeric OTP code with a length of 6.
The OTP Verification Code can be configured in the following ways

### `<Auth />` Component

Via the `otpConfig` prop

```tsx

export interface OtpConfig {
  otpLength?: number;
  alphanumeric?: boolean;
}

<Auth
  authConfig={authConfig}
  configOrder={configOrder}
  {...}
  otpConfig={{
    otpLength: 9,
    alphanumeric: true
  }}
/>
```

### `<OtpVerification />` Component

Via the `numBoxes` prop

```tsx
<OtpVerification
  type={emailInput ? OtpType.Email : OtpType.Sms}
  otpId={otpId!}
  onValidateSuccess={handleOtpSuccess}
  {...}
  numBoxes={9}
/>
```
