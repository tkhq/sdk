# @turnkey/sdk-browser

[![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-browser)

A SDK client with browser-specific abstractions for interacting with [Turnkey](https://turnkey.com) API. Also includes [@turnkey/http](https://www.npmjs.com/package/@turnkey/http), a lower-level, fully typed HTTP client.

Turnkey API documentation lives here: https://docs.turnkey.com.

## Getting started

```bash
$ npm install @turnkey/sdk-browser
```

```typescript
import {
  TurnkeyBrowserSDK,
  TurnkeySDKBrowserConfig,
  TurnkeySDKBrowserClient,
} from "@turnkey/sdk-browser";

// This config contains parameters including base URLs, iframe URLs, org ID, and rp ID (relying party ID for WebAuthn)
import turnkeyConfig from "./turnkey.json";

// Use the config to instantiate a Turnkey Client
const turnkeyClient = new TurnkeyBrowserSDK(turnkeyConfig);

// Now you can make authenticated requests!
const response = await turnkeyClient?.passkeySign.login();
```

## Helpers

`@turnkey/sdk-browser` provides `TurnkeySDKBrowserClient`, which offers wrappers around commonly used Turnkey activities, such as creating new wallets and wallet accounts.

// TODO:
// - explain subtypes within sdk-client.ts
// - point to demo wallet
