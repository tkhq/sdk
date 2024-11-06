# @turnkey/telegram-cloud-storage-stamper

[![npm](https://img.shields.io/npm/v/@turnkey/telegram-cloud-storage-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/telegram-cloud-storage-stamper)

This package contains functions to store a Turnkey API public/private key within [Telegram Cloud Storage](https://core.telegram.org/bots/webapps#cloudstorage). This package also handles stamping a Turnkey request with that API key. It is meant to be used with [`@turnkey/http`](https://www.npmjs.com/package/@turnkey/http)

Preqrequisites: \
Telegram Bot API >= 6.9

Usage:

Insert a new api key into Telegram Cloud Storage

```ts
import { TelegramCloudStorageStamper } from "@turnkey/telegram-cloud-storage-stamper";
import { TurnkeyBrowserClient, TurnkeySDKClientConfig } from "@turnkey/sdk-browser";

// create a new telegram cloud storage stamper
const stamper = TelegramCloudStorageStamper.create({
  apiPublicKey: "...",
  apiPrivateKey: "...",
});

// use the stamper in the client config
const browserConfig: TurnkeySDKClientConfig = {
  stamper: TelegramCloudStorageStamper!,
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: <ORGANIZATION_ID>,
};

// create a TurnkeyClient with the initialized Telegram Cloud Storage Stamper
const client = new TurnkeyBrowserClient(browserConfig);

// make a request with the client
const whoamiResponse = await client.getWhoami({
  organizationId: <ORGANIZATION_ID>,
});
```

Use an existing key that has been previously stored in Telegram Cloud Storage

```ts
import { TelegramCloudStorageStamper } from "@turnkey/telegram-cloud-storage-stamper";
import { TurnkeyBrowserClient, TurnkeySDKClientConfig } from "@turnkey/sdk-browser";

// create a new telegram cloud storage stamper
const stamper = TelegramCloudStorageStamper.create();

// use the stamper in the client config
const browserConfig: TurnkeySDKClientConfig = {
  stamper: TelegramCloudStorageStamper!,
  apiBaseUrl: "https://api.turnkey.com",
  organizationId: <ORGANIZATION_ID>,
};

// create a TurnkeyClient with the initialized Telegram Cloud Storage Stamper
const client = new TurnkeyBrowserClient(browserConfig);

// make a request with the client
const whoamiResponse = await client.getWhoami({
  organizationId: <ORGANIZATION_ID>,
});
```
