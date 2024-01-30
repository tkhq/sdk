# @turnkey/react-native-passkey-stamper

[![npm](https://img.shields.io/npm/v/@turnkey/react-native-passkey-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/react-native-passkey-stamper)

This package contains a React Native passkey stamper. It uses [`react-native-passkey`](https://github.com/f-23/react-native-passkey) to do the heavy lifting. This stamper is meant to be used with [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http)

Usage:

```ts
import { PasskeyStamper } from "@turnkey/react-native-passkey-stamper";
import { TurnkeyClient } from "@turnkey/http";

const stamper = new PasskeyStamper({
  rpId: "example.com",
});

// New HTTP client able to sign with passkeys!
const httpClient = new TurnkeyClient(
  { baseUrl: "https://api.turnkey.com" },
  stamper
);
```
