# @turnkey/indexed-db-stamper

[![npm](https://img.shields.io/npm/v/@turnkey/indexed-db-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/indexed-db-stamper)

The `@turnkey/indexed-db-stamper` package enables secure request stamping using an unextractable P-256 keypair stored in the browser’s IndexedDB. It serves the same purpose as [`@turnkey/api-key-stamper`](../api-key-stamper/), allowing you to sign and approve requests to Turnkey’s API, but without exposing the private key. This is ideal for long-lived browser sessions in progressive web apps (PWAs), wallet extensions, or any context where the key must remain secure and persistent across reloads.

The IndexedDbStamper generates the private key using SubtleCrypto and stores it in a non-exportable format, ensuring that it cannot be extracted or exfiltrated by application code. The keypair is stored in IndexedDB so that it can be reused in subsequent sessions.

Usage:

The `IndexedDbStamper` class implements the `TStamper` interface used by the `TurnkeyClient` in the [`@turnkey/http`](../http/) module. It encapsulates the logic necessary to sign activity requests and generates the appropriate HTTP headers for authentication.

```ts
import { IndexedDbStamper } from "@turnkey/indexed-db-stamper";

// Initialize the stamper and generate or load the keypair
const stamper = new IndexedDbStamper();
await stamper.init();

// Once initialized, the stamper is ready to be passed into the TurnkeyClient.
const httpClient = new TurnkeyClient(
  { baseUrl: "https://api.turnkey.com" },
  stamper,
);
```
