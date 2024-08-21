# @turnkey/sdk-server

[![npm](https://img.shields.io/npm/v/@turnkey/http?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/sdk-server)

A SDK client with server-specific abstractions for interacting with [Turnkey](https://turnkey.com) API. Also includes [@turnkey/http](https://www.npmjs.com/package/@turnkey/http), a lower-level, fully typed HTTP client.

Turnkey API documentation lives here: https://docs.turnkey.com.

## Getting started

```bash
$ npm install @turnkey/sdk-server
```

```js
const { Turnkey } = require("@turnkey/sdk-server");

// This config contains parameters including base URLs, API credentials, and org ID
const turnkeyConfig = JSON.parse(fs.readFileSync("./turnkey.json", "utf8"));

// Use the config to instantiate a Turnkey Client
const turnkeyServerClient = new Turnkey(turnkeyConfig);

// You're all set to create a server!
const turnkeyProxyHandler = turnkeyServerClient.expressProxyHandler({});

app.post("/apiProxy", turnkeyProxyHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Helpers

`@turnkey/sdk-server` provides `Turnkey`, which offers wrappers around commonly used Turnkey API setups. This enables you to easily stand up a minimal backend to proxy end-users' requests to Turnkey. You can also use this to call on the Turnkey API directly from a server setting.

// TODO:
// - typescript-ify example
// - include nextjs server example
