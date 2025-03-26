---
"@turnkey/sdk-react": patch
---

Add passkeyConfig to EWK

You can do this by passing optional `passkeyConfig` of interface `PasskeyConfig` to the `<Auth>` component

```
export interface PasskeyConfig {
  displayName?: string;
  name?: string;
}
```
