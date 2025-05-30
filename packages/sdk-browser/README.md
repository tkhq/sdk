# @turnkey/sdk-browser

[![npm](https://img.shields.io/npm/v/@turnkey/sdk-browser?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-browser)

A SDK client with browser-specific abstractions for interacting with [Turnkey](https://turnkey.com) API. Also includes [@turnkey/http](https://www.npmjs.com/package/@turnkey/http), a lower-level, fully typed HTTP client.

Turnkey API documentation lives here: https://docs.turnkey.com.

## Getting started

```bash
$ npm install @turnkey/sdk-browser
```

### Initialize

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const turnkey = new Turnkey({
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
  // Optional: Your relying party ID - for use with Passkey authentication
  rpId: process.env.TURNKEY_RP_ID,
});
```

### Turnkey Clients

#### Passkey

The Passkey client allows for authentication to Turnkey's API using Passkeys.

```typescript
const passkeyClient = turnkey.passkeyClient();

// User will be prompted to login with their passkey
await passkeyClient.login();

// Make authenticated requests to Turnkey API, such as listing user's wallets
const walletsResponse = await passkeyClient.getWallets();
```

#### Iframe

The Iframe client can be initialized to interact with Turnkey's hosted iframes for sensitive operations.
The `iframeContainer` parameter is required, and should be a reference to the DOM element that will host the iframe.
The `iframeUrl` is the URL of the iframe you wish to interact with.

The example below demonstrates how to initialize the Iframe client for use with [Email Auth](https://docs.turnkey.com/embedded-wallets/sub-organization-auth)
by passing in `https://auth.turnkey.com` as the `iframeUrl`.

```typescript
const iframeClient = await turnkey.iframeClient({
  // The container element that will host the iframe
  iframeContainer: document.getElementById("<iframe container id>"),
  iframeUrl: "https://auth.turnkey.com",
});

const injectedResponse = await iframeClient.injectCredentialBundle(
  "<Credential from Email>",
);
if (injectedResponse) {
  await iframeClient.getWallets();
}
```

##### IFrame URLs:

| Flow                                                                                  | URL                                                  |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Email Auth](https://docs.turnkey.com/embedded-wallets/sub-organization-auth)         | [auth.turnkey.com](https://auth.turnkey.com)         |
| [Email Recovery](https://docs.turnkey.com/embedded-wallets/sub-organization-recovery) | [recovery.turnkey.com](https://recovery.turnkey.com) |
| [Import Wallet](https://docs.turnkey.com/features/import-wallets)                     | [import.turnkey.com](https://import.turnkey.com)     |
| [Export Wallet](https://docs.turnkey.com/features/export-wallets)                     | [export.turnkey.com](https://export.turnkey.com)     |

#### Wallet

The Wallet client is designed for using your Solana or EVM wallet to stamp and approve activity requests for Turnkey's API.
This stamping process leverages the wallet's signature to authenticate requests.

The example below showcases how to use an injected Ethereum wallet to stamp requests to Turnkey's API.
The user will be prompted to sign a message containing the activity request payload to be sent to Turnkey.

```typescript
import {
  createWalletClient,
  custom,
  recoverPublicKey,
  hashMessage,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

import { WalletStamper, EthereumWallet } from "@turnkey/wallet-stamper";

const walletClient = turnkey.walletClient(new EthereumWallet());

// Make authenticated requests to Turnkey API, such as listing user's wallets
// User will be prompted to sign a message to authenticate the request
const walletsResponse = await walletClient.getWallets();
```

## Helpers

`@turnkey/sdk-browser` provides `TurnkeySDKBrowserClient`, which offers wrappers around commonly used Turnkey activities, such as creating new wallets and wallet accounts.

### IndexedDB Sessions (Recommended)

Turnkey now supports persistent, **secure, non-extractable authentication** using P-256 passkeys stored in **IndexedDB**. This replaces legacy iframe-based flows for otp, passkey, and OAuth authentication.

The [`TurnkeyIndexedDbClient`](https://github.com/tkhq/sdk/blob/main/packages/sdk-browser/src/__clients__/browser-clients.ts) provides a long-lived session mechanism where the private key never leaves the browser and is scoped per sub-organization. This client handles login, session persistence, and API request signing entirely on the client side — without requiring iframes or sensitive credential injection.

```ts
import { Turnkey } from "@turnkey/sdk-browser";

const turnkey = new Turnkey({
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: "<YOUR_PARENT_ORG_ID>",
  rpId: "<YOUR_WEBAUTHN_RELYING_PARTY_ID>",
});

const client = turnkey.indexedDbClient();
const passkeyClient = turnkey.passkeyClient();
// Create authenticated session
const pubKey = await indexedDbClient!.getPublicKey();
await passkeyClient?.loginWithPasskey({
  sessionType: SessionType.READ_WRITE,
  publicKey: pubKey!,
  expirationSeconds: "3600",
});

// Now the client is authenticated and ready to interact with Turnkey API
const wallets = await client.getWallets();
```

> 💡 **Why IndexedDB?**  
> Keys are stored using the [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey), marked as `nonExtractable`, and survive page reloads — offering persistent, tamper-resistant authentication without ever exposing the raw key material.

---

### ⚠️ Deprecated: iframeClient for Auth

Authentication via `iframeClient()` and injected credentials (e.g., from `https://auth.turnkey.com`) is now considered **deprecated** for new integrations. These flows required sensitive credential bundles to be delivered via email or OAuth and injected into a sandboxed iframe — a pattern with limited persistence and higher complexity.

Developers are encouraged to migrate to `indexedDbClient()` for:

- Seamless passkey authentication
- Improved security model (no credential injection)
- Long-lived, resumable sessions

Existing iframe use cases like **Email Recovery**, **Wallet Import**, and **Wallet Export** are still supported but should be isolated from authentication logic.
