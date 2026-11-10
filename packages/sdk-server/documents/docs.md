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

```js
import { Turnkey } from "@turnkey/sdk-server";

const turnkey = new Turnkey({
  defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID,
  apiBaseUrl: "https://api.turnkey.com",
  apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY,
  apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY,
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
