# @turnkey/http

[![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/http)

Typed HTTP client for interacting with [Turnkey](https://turnkey.io) API.

API Docs: https://turnkey.readme.io/

## Getting started

```bash
$ npm install @turnkey/http
```

Before making http calls, initialize the package with your credentials:

```typescript
import { PublicApiService, init } from "@turnkey/http";

init({
  apiPublicKey: "...",
  apiPrivateKey: "...",
  baseUrl: "...",
});

// Now you can make authenticated requests!
const data = await PublicApiService.postGetWhoami({
  body: {
    organizationId: "...",
  },
});
```
