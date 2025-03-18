---
"@turnkey/sdk-browser": major
"@turnkey/sdk-react": minor
"@turnkey/sdk-server": patch
---

### @turnkey/sdk-browser

- Move all type definitions to [`./__types__/base.ts`](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts)
- `TurnkeyBrowserClient`
  - `refereshSession()` now consumes a [RefreshSessionParams](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L213) parameter
  - `loginWithBundle()` now consumes a [LoginWithBundleParams](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L219) parameter
  - `loginWithPasskey()` now consumes a [LoginWithPasskeyParams](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L224) parameter
  - `loginWithWallet()` now consumes a [LoginWithWalletParams](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L231) parameter

### @turnkey/sdk-react

- `Auth.tsx`
  - updated `passkeyClient?.loginWithPasskey()` to implement new method signature
  - updated `walletClient?.loginWithWallet()` to implement new method signature

### @turnkey/sdk-server

- Move all type definitions to [`./__types__/base.ts`](https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-server/src/__types__/base.ts)
