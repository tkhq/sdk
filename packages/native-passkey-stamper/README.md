# @turnkey/api-key-stamper

[![npm](https://img.shields.io/npm/v/@turnkey/native-passkey-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/native-passkey-stamper)

This package contains functions to stamp a Turnkey request while using react-native. It is meant to be used with [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http)

Usage:

```ts
import { NativePasskeyStamper } from "@turnkey/native-passkey-stamper";
import { TurnkeyClient } from "@turnkey/http";

const stamper = new NativePasskeyStamper({...});

const httpClient = new TurnkeyClient(
  { baseUrl: "https://api.turnkey.com" },
  stamper
);
```
