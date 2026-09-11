---
title: "JavaScript Server"
description: "The [`@turnkey/sdk-server`](https://www.npmjs.com/package/@turnkey/sdk-server) package exposes functionality that lets developers build server-side functionality for applications that interact with the Turnkey API."
---

## Overview

It exposes a ready-made API client class which manages the process of constructing requests to the Turnkey API and authenticating them with a valid API key. Furthermore, it exposes API proxies that forward requests from your application's client that need to be signed by parent organizations API key.

Use the [`@turnkey/sdk-server`](https://www.npmjs.com/package/@turnkey/sdk-server) package to handle server-side interactions for applications that interact with the Turnkey API.

## Installation

<CodeGroup>

```bash npm
npm install @turnkey/sdk-server
```

```bash Yarn
yarn add @turnkey/sdk-server
```

</CodeGroup>

## Initializing

```typescript
import {
  Turnkey,
  ApiKeyStamper,
  TurnkeyServerClient,
} from "@turnkey/sdk-server";

const turnkey = new Turnkey({
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  apiBaseUrl: "https://api.turnkey.com",
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
});

// Or initialize a client with an explicit ApiKeyStamper:
const stamper = new ApiKeyStamper({
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
});

const client = new TurnkeyServerClient({
  stamper,
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
});
```

#### Parameters

<ParamField
body="config"
type="TurnkeySDKServerConfig"
required

>

An object containing configuration settings for the Server Client.

</ParamField>

<ParamField
body="defaultOrganizationId"
type="string"
required

>

The root organization that requests will be made from unless otherwise specified

</ParamField>
<ParamField
  body="apiBaseUrl"
  type="string"
  required
>

The base URL that API requests will be sent to (use [https://api.turnkey.com](https://api.turnkey.com) when making requests to Turnkey's API)

</ParamField>
<ParamField
  body="apiPrivateKey"
  type="string"
>

The API Private Key to sign requests with (this will normally be the API Private Key to your root organization)

</ParamField>
<ParamField
  body="apiPublicKey"
  type="string"
>

The API Public Key associated with the configured API Private Key above

</ParamField>
## Creating Clients

Calls to Turnkey's API must be signed with a valid credential (often referred to in the docs as [stamping](https://docs.turnkey.com/developer-reference/api-overview/stamps)) from the user initiating the API call. When using the Server SDK, the user initiating the API call is normally your root organization, and the API call is authenticated with the API keypair you create on the Turnkey dashboard.

#### `apiClient()`

The `apiClient` method returns an instance of the `TurnkeyApiClient` which will sign requests with the injected `apiPrivateKey`, and `apiPublicKey` credentials.

```js
const apiClient = turnkey.apiClient();
const walletsResponse = await apiClient.getWallets();

// this will sign the request with the configured api credentials
```

## Creating API Proxies

There are certain actions that are initiated by users, but require the activity to be signed by the root organization itself. Examples of this include the initial creation of the user `subOrganization` or sending an email to a user with a login credential as part of an `emailAuth` flow.

These can be implemented in your backend by creating an `apiClient` and handling requests from your browser application at different routes, but we have also provided a convenience method for doing this by having allowing a single `apiProxy` to handle requests at a single route and automatically sign specific user actions with the root organization's credentials.

#### expressProxyHandler()

The `expressProxyHandler()` method creates a proxy handler designed as a middleware for Express applications. It provides an API endpoint that forwards requests to the Turnkey API server.

```js
const turnkeyProxyHandler = turnkey.expressProxyHandler({
  allowedMethods: ["createSubOrganization", "emailAuth", "getSubOrgIds"],
});

app.post("/apiProxy", turnkeyProxyHandler);

// this will sign requests made with the client-side `serverSign` function with the root organization's API key for the allowedMethods in the config
```

#### 2. nextProxyHandler()

The `nextProxyHandler()` method creates a proxy handler designed as a middleware for Next.js applications. It provides an API endpoint that forwards requests to the Turnkey API server.

```js
// Configure the Next.js handler with allowed methods
const turnkeyProxyHandler = turnkey.nextProxyHandler({
  allowedMethods: ["createSubOrganization", "emailAuth", "getSubOrgIds"],
});

export default turnkeyProxyHandler;

// this will sign requests made with the client-side `serverSign` function with the root organization's API key for the allowedMethods in the config
```

## Turnkey Server Actions

The `@turnkey/sdk-server` exposes NextJS Server Actions via `server`. These server actions can be used to facilitate implementing common authentication flows.

### `sendOtp()`

Initiate an OTP authentication flow for either an `EMAIL` or `SMS`.

```typescript
import { server } from "@turnkey/sdk-server";

const initAuthResponse = await server.sendOtp({
  otpType,
  contact: value,
  appName: "My App",
  ...(emailCustomization && { emailCustomization }),
  ...(sendFromEmailAddress && { sendFromEmailAddress }),
  ...(customSmsMessage && { customSmsMessage }),
  userIdentifier: authIframeClient?.iframePublicKey!,
  otpLength: 6,
  alphanumeric: true,
});

if (initAuthResponse?.otpId) {
  // proceed to verifyOtp
} else {
  // error handling
}
```

#### Parameters

<ParamField body="request" type="SendOtpRequest" required>
  An object containing the parameters to initiate an `EMAIL` or `SMS` OTP
  authentication flow.
</ParamField>

<ParamField body="otpType" type="string" required>
  The type of OTP request, either `EMAIL` or `SMS`.
</ParamField>

<ParamField body="contact" type="string" required>
  The contact information (email or phone number) where the OTP will be sent.
</ParamField>

<ParamField body="appName" type="string" required>
  The name of the application initiating the OTP request.
</ParamField>

<ParamField body="userIdentifier" type="string">
  IP Address, iframePublicKey, or other unique identifier used for rate
  limiting.
</ParamField>

<ParamField body="customSmsMessage" type="string">
  Use to customize the SMS message.
</ParamField>

<ParamField body="emailCustomization" type="EmailCustomization">
  An option to customize the email.
</ParamField>

<ParamField body="sendFromEmailAddress" type="string">
  Provide a custom email address which will be used as the sender of the email.
</ParamField>

<ParamField body="otpLength" type="number">
  The length of the OTP code.
</ParamField>

<ParamField body="alphanumeric" type="boolean">
  Whether the OTP should contain alphanumeric characters. Defaults to true.
</ParamField>

### `verifyOtp()`

Verify the encrypted OTP bundle sent to the user via `EMAIL` or `SMS`. If verification is successful, a `verificationToken` is returned which can be passed to `otpLogin()` to complete session login.

```typescript
import { server } from "@turnkey/sdk-server";

const verifyResponse = await server.verifyOtp({
  otpId,
  encryptedOtpBundle,
  sessionLengthSeconds,
});

if (verifyResponse?.verificationToken) {
  // Log in using otpLogin with the verificationToken
  const sessionResponse = await server.otpLogin({
    suborgID: suborgId,
    verificationToken: verifyResponse.verificationToken,
    publicKey: authIframeClient!.iframePublicKey!,
    clientSignature,
    sessionLengthSeconds,
  });

  if (sessionResponse?.session) {
    await authIframeClient!.loginWithSession(sessionResponse.session);
    await onValidateSuccess();
  }
} else {
  // error handling
}
```

#### Parameters

<ParamField body="request" type="VerifyOtpRequest" required>
  An object containing the parameters to verify an OTP authentication attempt.
</ParamField>

<ParamField body="otpId" type="string" required>
  The ID for the given OTP request. This ID is returned in the `SendOtpResponse`
  from `sendOtp()`.
</ParamField>

<ParamField body="encryptedOtpBundle" type="string" required>
  The encrypted OTP bundle generated for verification.
</ParamField>

<ParamField body="sessionLengthSeconds" type="number">
  Specify the length of the session in seconds. Defaults to 900 seconds or 15
  minutes.
</ParamField>

### `otpLogin()`

Complete an OTP login flow using the `verificationToken` from `verifyOtp()` and a signed public key.

```typescript
import { server } from "@turnkey/sdk-server";

const sessionResponse = await server.otpLogin({
  suborgID: suborgId,
  verificationToken: verifyResponse.verificationToken,
  publicKey: authIframeClient!.iframePublicKey!,
  clientSignature,
  sessionLengthSeconds,
});

if (sessionResponse?.session) {
  // log in with Session
  await authIframeClient!.loginWithSession(sessionResponse.session);
  await onValidateSuccess();
} else {
  // error handling
}
```

#### Parameters

<ParamField body="request" type="OtpLoginRequest" required>
  An object containing the parameters to complete an OTP authentication session.
</ParamField>

<ParamField body="suborgID" type="string" required>
  The ID of the sub organization for the given request.
</ParamField>

<ParamField body="verificationToken" type="string" required>
  The verification token returned from `verifyOtp()`.
</ParamField>

<ParamField body="publicKey" type="string" required>
  The public key to associate with the authenticated session.
</ParamField>

<ParamField body="clientSignature" type="ClientSignature" required>
  The client signature verifying possession of the private key.
</ParamField>

<ParamField body="sessionLengthSeconds" type="number">
  Specify the length of the session in seconds. Defaults to 900 seconds or 15
  minutes.
</ParamField>

### `oauthLogin()`

Complete an OAuth authentication flow once the OIDC Token has been obtained from the OAuth provider.

```typescript
import { server } from "@turnkey/sdk-server";

const oauthSession = await server.oauthLogin({
  suborgID: suborgId!,
  oidcToken: credential,
  publicKey: authIframeClient?.iframePublicKey!,
  sessionLengthSeconds: authConfig.sessionLengthSeconds,
});

if (oauthSession?.session) {
  // log in with Session
  await authIframeClient!.loginWithSession(oauthSession.session);
  // call onAuthSuccess callback
  await onAuthSuccess();
} else {
  // error handling
}
```

#### Parameters

<ParamField body="request" type="OauthLoginRequest" required>
  An object containing the parameters to complete an OAuth authentication flow.
</ParamField>

<ParamField body="suborgID" type="string" required>
  The ID of the sub organization for the given request.
</ParamField>

<ParamField body="oidcToken" type="string" required>
  The OIDC (OpenID Connect) Token issued by the OAuth provider which contains
  basic profile information about the user.
</ParamField>

<ParamField body="publicKey" type="string" required>
  The public key of the target user.
</ParamField>

<ParamField body="sessionLengthSeconds" type="number">
  Specify the length of the session in seconds. Defaults to 900 seconds or 15
  minutes.
</ParamField>

### `sendCredential()`

Send a login credential to a user's email address.

```typescript
import { server } from "@turnkey/sdk-server";

const sendCredentialResponse = await server.sendCredential({
  email,
  targetPublicKey: authIframeClient?.iframePublicKey!,
  suborgID: suborgId!,
  emailCustomization: {
    appName: "My App",
    ...emailCustomization,
  },
  ...(apiKeyName && { apiKeyName }),
  ...(sendFromEmailAddress && { sendFromEmailAddress }),
  ...(sessionLengthSeconds && { sessionLengthSeconds }),
  ...(invalidateExisting && { invalidateExisting }),
});
```

#### Parameters

<ParamField body="request" type="InitEmailAuthRequest" required>
  An object containing the parameters to send a login credential via email.
</ParamField>

<ParamField body="email" type="string" required>
  The email address provided by the user.
</ParamField>

<ParamField body="targetPublicKey" type="string" required>
  The public key of the target user.
</ParamField>

<ParamField body="suborgID" type="string" required>
  The ID of the sub organization for the given request.
</ParamField>

<ParamField body="emailCustomization" type="EmailCustomization" required>
  An option to customize the email. Must include `appName`.
</ParamField>

<ParamField body="apiKeyName" type="string">
  The name of the API Key.
</ParamField>

<ParamField body="userIdentifier" type="string">
  IP Address, iframePublicKey, or other unique identifier used for rate
  limiting.
</ParamField>

<ParamField body="sessionLengthSeconds" type="number">
  Specify the length of the session in seconds. Defaults to 900 seconds or 15
  minutes.
</ParamField>

<ParamField body="invalidateExisting" type="boolean">
  Invalidate all pre-existing sessions. Defaults to `false`.
</ParamField>

<ParamField body="sendFromEmailAddress" type="string">
  Provide a custom email address which will be used as the sender of the email.
</ParamField>
