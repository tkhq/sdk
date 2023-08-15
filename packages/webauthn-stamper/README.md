# @turnkey/webauthn-stamper

[![npm](https://img.shields.io/npm/v/@turnkey/webauthn-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/webauthn-stamper)

This package contains functions to stamp a Turnkey request. It is meant to be used with [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http)

Usage:

```ts
import { WebauthnStamper } from "@turnkey/webauthn-stamper";
import { TurnkeyClient } from "@turnkey/http";

const stamper = new WebAuthnStamper({
  rpId: "example.com",
});

// New HTTP client able to sign with passkeys!
const httpClient = new TurnkeyClient(
  { baseUrl: "https://api.turnkey.com" },
  stamper
);
```
