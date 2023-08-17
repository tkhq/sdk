# @turnkey/api-key-stamper

[![npm](https://img.shields.io/npm/v/@turnkey/api-key-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/api-key-stamper)

This package contains functions to stamp a Turnkey request. It is meant to be used with [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http)

Usage:

```ts
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyClient } from "@turnkey/http";

const stamper = new ApiKeyStamper({
  apiPublicKey: "...",
  apiPrivateKey: "...",
});

const httpClient = new TurnkeyClient(
  { baseUrl: "https://api.turnkey.com" },
  stamper
);
```
