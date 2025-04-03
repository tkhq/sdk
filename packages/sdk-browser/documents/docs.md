---
title: "JavaScript Browser"
sidebar_position: 2
description: JavaScript Browser SDK
slug: /sdks/javascript-browser
---

import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import Parameter from "@site/src/components/parameter";

## Overview

The [`@turnkey/sdk-browser`](https://www.npmjs.com/package/@turnkey/sdk-browser) package exposes functionality that lets developers build browser based applications that interact with the Turnkey API with different types of authentication.

It consists of the `passkeyClient`, `iframeClient` and `walletClient` that enable requests to the API to be authenticated via different auth methods. It also contains methods to manage information and state related to authentication like auth bundles and sessions, retrieving user information and server signing API requests.

If you are working with React – check out our [`@turnkey/sdk-react`](https://www.npmjs.com/package/@turnkey/sdk-react) package.

## Installation

<Tabs>
  <TabItem value="npm" label="NPM" default>

```bash
npm install @turnkey/sdk-browser
```

  </TabItem>
  <TabItem value="yarn" label="Yarn" >

```bash
yarn add @turnkey/sdk-browser
```

  </TabItem>

</Tabs>

## Initializing

```typescript
import { Turnkey } from "@turnkey/sdk-browser";
const turnkey = new Turnkey({
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
});
```

#### Parameters

<Parameter
style={{ borderBottom: "none", paddingBottom: "none"}}
param={{
    name: 'config',
    type: {
      name: 'TurnkeySDKBrowserConfig',
      link: 'https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L179'
    }
  }}
isRequired

>

An object containing configuration settings for the Browser Client.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'defaultOrganizationId',
    type: {
      name: 'string',
    }
  }}
isRequired

>

The root organization that requests will be made from unless otherwise specified

</Parameter>

<Parameter
style={{ paddingLeft: "12px"}}
param={{
    name: 'apiBaseUrl',
    type: {
      name: 'string',
    }
  }}
isRequired

>

The base URL that API requests will be sent to (use https://api.turnkey.com when making requests to Turnkey's API)

</Parameter>

<Parameter
style={{ paddingLeft: "12px"}}
param={{
    name: 'rpId',
    type: {
      name: 'string',
    }
  }}

>

The Relying Party ID used for WebAuthn flows (will default to the value returned from `window.location.hostname` unless otherwise specified)

</Parameter>

<Parameter
style={{ paddingLeft: "12px"}}
param={{
    name: 'serverSignUrl',
    type: {
      name: 'string',
    }
  }}

>

The URL to send requests that need to be signed from a backend codebase by the root organization's API key if using the `serverSign` flow.

</Parameter>

Calls to Turnkey's API must be signed with a valid credential from the appropriate user and, from a browser client, can either be sent directly to Turnkey or proxied through a server. Turnkey's Browser SDK contains the following different clients that manage the process of validating these requests depending on the kind of authentication credential that is being used.

## TurnkeyBrowserClient

The `TurnkeyBrowserClient` wraps Turnkey's basic SDK client with browser session management functionality. This client allows you to create a read only session that only authenticates read requests, or a read write session. It uses local storage for session management. The constructor for `TurnkeyBrowserClient` optionally takes in `AuthClient` which tracks which client was used for the initial authentication, to be used for retrieval purposes. Each subclass of `TurnkeyBrowserClient` (including `TurnkeyPasskeyClient`, `TurnkeyIframeClient` and `TurnkeyWalletClient`) will also set this to the respective value when used.

Below are all of the methods exposed by `TurnkeyBrowserClient`

### `login()`

Creates a read-only session for the current user, storing session details like userId, organizationId, sessionExpiry and which authentication client was used in local storage. This session allows for read-only actions within the Turnkey API. If you would like to instantiate a read only `TurnkeyBrowserClient` after logging in, you can use the [`currentUserSession()`](#currentusersession) method.

```typescript
import { TurnkeyBrowserClient } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const browserClient = new TurnkeyBrowserClient(config);

// Logs in to create a read-only session, storing the session in local storage
const readOnlySession = await browserClient.login({ organizationId: "org-id" });
```

### `loginWithBundle()`

Authenticate a user via the credential bundle emailed to them and creates a read-write session

#### Parameters

<Parameter
style={{ borderBottom: "none", paddingBottom: "none"}}
param={{
    name: 'params',
    type: {
      name: 'LoginWithBundleParams',
      link: 'https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L219'
    }
  }}
isRequired

> An object containing the parameters to authenticate via a Passkey.

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'bundle',
    type: {
      name: 'string',
    }
  }}
isRequired

>

The credential bundle string emailed to the user.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'expirationSeconds',
    type: {
      name: 'string',
    }
  }}

>

Specify the length of the session in seconds. Defaults to 900 seconds or 15 minutes.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'targetPublicKey',
    type: {
      name: 'string',
    }
  }}

>

The public key of the target user. This will be inferred from the `TurnkeyIframeClient` if `targetPublicKey` is not provided.

</Parameter>

</Parameter>

### `loginWithPasskey()`

Authenticate a user via Passkey and create a read-only or read-write session

#### Parameters

<Parameter
style={{ borderBottom: "none", paddingBottom: "none"}}
param={{
    name: 'params',
    type: {
      name: 'LoginWithPasskeyParams',
      link: 'https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L224'
    }
  }}
isRequired

> An object containing the parameters to authenticate via a Passkey.

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'sessionType',
    type: {
      name: 'SessionType',
    }
  }}
isRequired

>

The type of session to be created. Either read-only or read-write.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'iframeClient',
    type: {
      name: 'TurnkeyIframeClient',
    }
  }}
isRequired

>

An instance of a `TurnkeyIframeClient`

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'expirationSeconds',
    type: {
      name: 'string',
    }
  }}

>

Specify the length of the session in seconds. Defaults to 900 seconds or 15 minutes.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'targetPublicKey',
    type: {
      name: 'string',
    }
  }}

>

The public key of the target user. This will be inferred from the `TurnkeyIframeClient` if `targetPublicKey` is not provided.

</Parameter>

</Parameter>

### `loginWithSession()`

Log in with a session object created via a server action. The session can be either read-only or read-write.

#### Parameters

<Parameter
style={{ borderBottom: "none", paddingBottom: "none"}}
param={{
    name: 'session',
    type: {
      name: 'Session',
      link: 'https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L25'
    }
  }}
isRequired

> An existing session to authenticate the user with.

</Parameter>

### `loginWithWallet()`

Login with an existing wallet e.g. Metamask

#### Parameters

<Parameter
style={{ borderBottom: "none", paddingBottom: "none"}}
param={{
    name: 'params',
    type: {
      name: 'LoginWithWalletParams',
      link: 'https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L231'
    }
  }}
isRequired

> An object containing the parameters to authenticate via a browser wallet.
> <Parameter
> style={{ paddingTop: '0', paddingLeft: "12px"}}
> param={{

    name: 'sessionType',
    type: {
      name: 'SessionType',
    }

}}
isRequired

>

The type of session to be created. Either read-only or read-write.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'iframeClient',
    type: {
      name: 'TurnkeyIframeClient',
    }
  }}
isRequired

>

An instance of a `TurnkeyIframeClient`

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'expirationSeconds',
    type: {
      name: 'string',
    }
  }}

>

Specify the length of the session in seconds. Defaults to 900 seconds or 15 minutes.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'targetPublicKey',
    type: {
      name: 'string',
    }
  }}

>

The public key of the target user. This will be inferred from the `TurnkeyIframeClient` if `targetPublicKey` is not provided.

</Parameter>

</Parameter>

### `refreshSession()`

Attempts to refresh an existing, active session and will extend the session expiry using the `expirationSeconds` parameter

#### Parameters

<Parameter
style={{ borderBottom: "none", paddingBottom: "none"}}
param={{
    name: 'request',
    type: {
      name: 'RefreshSessionParams',
      link: 'https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L213'
    }
  }}
isRequired

>

An object containing the `RefreshSessionParams`.

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'sessionType',
    type: {
      name: 'SessionType',
      link: 'https://github.com/tkhq/sdk/blob/494911d948d0a53c0d00aa01e9821aefd5e3f80d/packages/sdk-browser/src/__types__/base.ts#L20'
    }
  }}
isRequired

>

The type of `Session` that is being refreshed.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'expirationSeconds',
    type: {
      name: 'string',
    }
  }}

>

Specify how long to extend the session. Defaults to 900 seconds or 15 minutes.

</Parameter>

<Parameter
style={{ paddingTop: '0', paddingLeft: "12px"}}
param={{
    name: 'targetPublicKey',
    type: {
      name: 'string',
    }
  }}

>

The public key of the target user. This will be inferred from the `TurnkeyIframeClient` if `targetPublicKey` is not provided.

</Parameter>

</Parameter>

### `loginWithReadWriteSession()`

Creates a read-write session. This method infers the current user's organization ID and target userId. To be used in conjunction with an `iframeStamper`: the resulting session's credential bundle can be injected into an iframeStamper to create a session that enables both read and write requests.

```typescript
import { TurnkeyBrowserClient } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const browserClient = new TurnkeyBrowserClient(config);

// Logs in to create a read-write session, using a target embedded key and session expiration
const readWriteSession = await browserClient.loginWithReadWriteSession(
  "target-embedded-key",
  "900", // Session expires in 15 minutes
  "user-id"
);
```

## TurnkeyPasskeyClient

The `TurnkeyPasskeyClient` class extends `TurnkeyBrowserClient` and specializes it for user authentication through Passkeys, which leverage the WebAuthn standard for passwordless authentication. This class enables the implementation of strong, user-friendly authentication experiences in a web-based application without relying on passwords. TurnkeyPasskeyClient handles passkey creation, session management with passkeys and integrates with WebAuthn and Embedded API Keys.

To see how to instantiate the `TurnkeyPasskeyClient`, [look here](#passkeyclient)

Below are the methods exposed by the `TurnkeyPasskeyClient`

### `createUserPasskey()`

Creates a Passkey for an end-user, handling lower-level configurations for the WebAuthn protocol, including challenges and user details. For more detailed examples using this method [look here](/embedded-wallets/code-examples/add-credential).

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// Create a Passkey client instance
const passkeyClient = turnkeySDK.passkeyClient();

// Creates a new user passkey with WebAuthn protocol details
const passkey = await passkeyClient.createUserPasskey({
  publicKey: {
    rp: { name: "Example Relying Party" },
    user: { name: "testUser", displayName: "Test User" },
  },
});
```

### `createPasskeySession()`

Uses Passkey authentication to create a read-write session, via an embedded API key, and stores + returns the resulting auth bundle that contains the encrypted API key. This auth bundle (also referred to as a credential bundle) can be injected into an iframeStamper, resulting in a touch-free authenticator. Unlike `loginWithReadWriteSession`, this method assumes the end-user's organization ID (i.e. the sub-organization ID) is already known.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// Create a Passkey client instance
const passkeyClient = turnkeySDK.passkeyClient();

// Creates a read-write session using a passkey with a specific expiration and organization ID
const session = await passkeyClient.createPasskeySession(
  "user-id",
  "target-embedded-key",
  "1800", // Expire in 30 minutes
  "org-id"
);
```

## TurnkeyIframeClient

The `TurnkeyIframeClient` class extends `TurnkeyBrowserClient` such that it is specialized for use with an iframe-based session. Our iFrame stamping implementation leverages the postMessage communication mechanism to send and receive messages within the iframe, ensuring the credential does not leave its secure environment. This approach is particularly crucial in sensitive flows such as Email Auth, and Key or Wallet Export, where heightened security is required. For further information on our iframe stamping process, checkout our [iframeStamper package documentation](./advanced/iframe-stamper).

To see how to instantiate the `TurnkeyIframeClient`, [look here](#iframeclient).

Here are all of the methods exposed by `TurnkeyIframeClient`

### `injectCredentialBundle()`

Injects an encrypted credential bundle (API key or session token) directly into the iframe for session-based authentication and authorization.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// Create a Passkey client instance
const iframeClient = turnkeySDK.iframeClient();

// Injects a credential bundle into the iframe for session management
const success = await iframeClient.injectCredentialBundle(
  "your-credential-bundle"
);
```

### `injectWalletExportBundle()`

Injects a wallet export bundle into the iframe, associating it with a specified organization. This allows secure transfer of wallet credentials.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// Create a Passkey client instance
const iframeClient = turnkeySDK.iframeClient();

// Injects a credential bundle into the iframe for session management
const success = await iframeClient.injectWalletExportBundle(
  "wallet-bundle",
  "org-id"
);
```

### `injectKeyExportBundle()`

Injects a key export bundle into the iframe, supporting optional key formats. This is useful for transferring specific key credentials securely.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// Create a Passkey client instance
const iframeClient = turnkeySDK.iframeClient();

// Injects a key export bundle with an optional key format
const success = await iframeClient.injectKeyExportBundle(
  "key-bundle",
  "org-id",
  "PEM"
);
```

### `injectImportBundle()`

Injects an import bundle into the iframe, associating it with a specific organization and user, enabling secure import of user credentials.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// Create a Passkey client instance
const iframeClient = turnkeySDK.iframeClient();

// Injects an import bundle for a specific organization and user
const success = await iframeClient.injectImportBundle(
  "import-bundle",
  "org-id",
  "user-id"
);
```

### `extractWalletEncryptedBundle()`

Extracts an encrypted wallet bundle from the iframe. Useful for securely retrieving wallet credentials from the iframe to the main application.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// Create a Passkey client instance
const iframeClient = turnkeySDK.iframeClient();

// Extracts the encrypted wallet bundle from the iframe
const walletBundle = await iframeClient.extractWalletEncryptedBundle();
```

### `extractKeyEncryptedBundle()`

Extracts an encrypted key bundle from the iframe, providing secure retrieval of key credentials.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// Create a Passkey client instance
const iframeClient = turnkeySDK.iframeClient();

// Extracts the encrypted key bundle from the iframe
const keyBundle = await iframeClient.extractKeyEncryptedBundle();
```

## TurnkeyWalletClient

The `TurnkeyWalletClient` extends `TurnkeyBrowserClient` such that it is specialized for using a wallet to stamp and authenticate requests to the Turnkey API. This stamping process leverages your wallet's signature key to authenticate requests securely.

### `getPublicKey()`

This method enables easy access to the wallet public key from the `TurnkeyWalletClient` to be used in authentication flows.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";
import { EthereumWallet } from "@turnkey/wallet-stamper";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

const walletClient = turnkeySDK.walletClient(new EthereumWallet());
const publicKey = await walletsClient.getPublicKey();
```

### `getWalletInterface()`

This method provides easy access to the full object that represents the wallet being used to stamp requests for this client.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";
import { EthereumWallet } from "@turnkey/wallet-stamper";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

const walletClient = turnkeySDK.walletClient(new EthereumWallet());
const wallet = await walletsClient.getWalletInterface();
```

## Top Level SDK Functions in `TurnkeyBrowserSDK`

The `TurnkeyBrowserSDK` serves as the main entry point for interacting with Turnkey's services in a web browser environment. It contains methods to instantiate clients like the `TurnkeyPasskeyClient` and the `TurnkeyIframeClient`. manage information and state related to authentication like auth bundles and sessions, retrieving user information and server signing API requests.The client enables easy access to the wallet public key to be used for authentication flows.

### `passkeyClient()`

Creates an instance of TurnkeyPasskeyClient with a specified or default rpId (relying party ID). This client can prompt users to sign with a passkey credential for authentication. If you'd like to use your passkey client to proxy requests to your server, to be signed with parent organization credentials, include the server URL in the `serverSignUrl` parameter.

{/_ <!-- TODO -- Link to example for server signing once server action work has been completed --> _/}

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
  serverSignUrl: "https://your-server-sign-url.com",
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

const passkeyClient = turnkeySDK.passkeyClient();
const walletsResponse = await passkeyClient.getWallets();
```

### `iframeClient()`

Creates an instance of `TurnkeyIframeClient` by initializing an iframe stamper with the specified iframeUrl
and optional element ID. The iframe client is used to interact with a series of iframes hosted by Turnkey,
designed for sensitive operations such as storing an expiring credential within the [Email Recovery](/authentication/email#recovery-flow)
and [Email Auth](/authentication/email) flows, and facilitating Wallet [Import](/wallets/import-wallets) and [Export](/wallets/export-wallets).
The code powering these iframes can be found at https://github.com/tkhq/frames. If you'd like to use your iframe client to proxy
requests to your server, to be signed with parent organization credentials, include the server URL in the `serverSignUrl` parameter.

{/_ <!-- TODO -- Link to example for server signing once server action work has been completed --> _/}

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
  serverSignUrl: "https://your-server-sign-url.com",
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

const iframeClient = await turnkeySDK.iframeClient({
  iframeContainer: document.getElementById("<iframe container id>"),
  iframeUrl: "https://auth.turnkey.com",
});
const response = await iframeClient.injectCredentialBundle(
  "<Credential from Email>"
);
if (response) {
  await iframeClient.getWallets();
}

// this requires the developer to build a wrapper flow that can take user text input in their app and call the injectCredentialBundle function on the turnkey iframeClient
```

### `walletClient()`

Creates an instance of `TurnkeyWalletClient`, taking in an wallet, wrapped by an object that matches the `WalletInterface` class. The wallet client is used to interact with the Turnkey API, authenticating requests by using the wallet to stamp the requests. If you'd like to use your wallet client to proxy requests to your server, to be signed with parent organization credentials, include the server URL in the `serverSignUrl` parameter.

{/_ <!-- TODO -- Link to example for server signing once server action work has been completed --> _/}

```typescript
import { Turnkey } from "@turnkey/sdk-browser";
import { EthereumWallet } from "@turnkey/wallet-stamper";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
  serverSignUrl: "https://your-server-sign-url.com",
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

const walletClient = turnkeySDK.walletClient(new EthereumWallet());
```

### `serverSign()`

The serverSign function is used to proxy requests from a root parent organization to a child organization. The API key cannot be stored client-side, which is why the serverSign flow exists: to forward authenticated client-side requests to Turnkey via proxy backend.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
    apiBaseUrl: "https://api.turnkey.com",
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
    serverSignUrl: "https://your-server-sign-url.com",
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

const subOrgIdsResponse = await turnkeySDK.serverSign(
 "getSubOrgIds",
   [{
     filterType: "EMAIL",
     filterValue: email
   }]
 )!

if (subOrgIdsResponse.organizationIds?.length > 0) {
 const emailAuthResponse = await turnkeySDK.serverSign(
   "emailAuth",
   [{
     email: email,
     targetPublicKey: <iframeClient.iframePublicKey>,
     organizationId: subOrgIdsResponse.organizationIds[0]
   }]
 )
}
```

### `getSession()`

Attempts to refresh an existing, active session and will extend the session expiry using the `expirationSeconds` parameter

### `currentUserSession()`

Generally speaking, in order to ensure a seamless UX, you might not want a passkey user have to manually authenticate every read request from Turnkey's API with a credential (e.g. via FaceID or TouchID). In order to reduce friction, you can have a user login() to Turnkey with a credential once. This method facilitates this process and creates an instance of The TurnkeyBrowserClient that allows multiple read-only requests to Turnkey's API.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

const passkeyClient = turnkeySDK.passkeyClient();
await passkeySigner.login();

// when a user logs in with the Turnkey SDK, a read-only API credential is saved in localStorage and can be used to make API read requests on their behalf

const userSessionClient = await turnkeySDK.currentUserSession();
const walletsResponse = await userSessionClient.getWallets();

// this API call happens without any confirmation step because the user now has an active read-only session
```

### `getReadWriteSession()`

If there is a valid, current read-session, this will return an auth bundle and its expiration. This auth bundle can be used in conjunction with an iframeStamper to create a read + write session.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// gets auth bundle to be used with an iframeStamperto create a read write session
const readWriteSession = await turnkeySDK.getReadWriteSession();
```

### `getCurrentSubOrganization()`

Retrieves information about the user's current sub-organization from the user data stored in local storage. Useful for obtaining the user's organization context.

```typescript
import { Turnkey } from "@turnkey/sdk-browser";

const config = {
  apiBaseUrl: "https://api.turnkey.com",
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
};

// Create a client instance
const turnkeySDK = new Turnkey(config);

// retrieves users current sub organization
const subOrganization = await turnkeySDK.getCurrentSubOrganization();
```

## Examples

#### [1. Implementing an embedded wallet authentication flow with passkeys](/embedded-wallets/code-examples/create-sub-org-passkey)

#### [2. Implementing an embedded wallet authentication flow with email](/embedded-wallets/code-examples/authenticate-user-email)

#### [3. Signing Transactions](/embedded-wallets/code-examples/signing-transactions)
