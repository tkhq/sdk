# @turnkey/telegram-stamper

[![npm](https://img.shields.io/npm/v/@turnkey/telegram-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/telegram-stamper)

This package contains functions to store a turnkey api public/private key within [Telegram Cloud Storage](https://core.telegram.org/bots/webapps#cloudstorage). This package also handles stamping a Turnkey request with that api key. It is meant to be used with [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http)

Preqrequisites: \
Telegram Bot API >= 6.9

Usage:

Insert a new api key into Telegram Cloud Storage

```ts
import { TelegramStamper } from "@turnkey/telegram-stamper";
import { TurnkeyBrowserClient, TurnkeySDKClientConfig } from "@turnkey/sdk-browser";

// create a new telegram stamper
const stamper = new TelegramStamper({
  apiPublicKey: "...",
  apiPrivateKey: "...",
});

// initialize the telegram stamper, this stores the api key credentials in Telegram Cloud Storage for the first time
try {
  await stamper.init();
} catch (err) {
  throw new Error(`Failed initializing Telegram Stamper: ${err}`)
}

// use the stamper in the client config
const browserConfig: TurnkeySDKClientConfig = {
  stamper: telegramStamper!,
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: <ORGANIZATION_ID>,
};

// create a TurnkeyClient with the initialized Telegram Stamper
const client = new TurnkeyBrowserClient(browserConfig);

// make a request with the client
const whoamiResponse = await client.getWhoami({
  organizationId: <ORGANIZATION_ID>,
});
```

Use an exisiting key that has been previously stored in Telegram Cloud Storage

```ts
import { TelegramStamper } from "@turnkey/telegram-stamper";
import { TurnkeyBrowserClient, TurnkeySDKClientConfig } from "@turnkey/sdk-browser";

// create a new telegram stamper
const stamper = new TelegramStamper();

// initialize the telegram stamper, this gets the api key credentials from Telegram Cloud Storage
try {
  await stamper.init();
} catch (err) {
  throw new Error(`Failed initializing Telegram Stamper: ${err}`)
}

// use the stamper in the client config
const browserConfig: TurnkeySDKClientConfig = {
  stamper: telegramStamper!,
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: <ORGANIZATION_ID>,
};

// create a TurnkeyClient with the initialized Telegram Stamper
const client = new TurnkeyBrowserClient(browserConfig);

// make a request with the client
const whoamiResponse = await client.getWhoami({
  organizationId: <ORGANIZATION_ID>,
});
```
