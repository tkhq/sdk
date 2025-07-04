# @turnkey/telegram-cloud-storage-stamper

[![npm](https://img.shields.io/npm/v/@turnkey/telegram-cloud-storage-stamper?color=%234C48FF)](https://www.npmjs.com/package/@turnkey/telegram-cloud-storage-stamper)

This package contains functions to store Turnkey API public/private keys and arbitrary data within [Telegram Cloud Storage](https://core.telegram.org/bots/webapps#cloudstorage). This package also handles stamping a Turnkey request with an API key. It is meant to be used with [`@turnkey/sdk-browser`](https://www.npmjs.com/package/@turnkey/sdk-browser).

### Preqrequisites

Telegram Bot API >= 6.9

### About

The Telegram Cloud Storage Stamper has a few different modes of operation, namely a classic [stamper](https://docs.turnkey.com/developer-reference/api-overview/stamps) for stamping requests made to Turnkey's API, and an interface for a Telegram Mini App built with Turnkey to interact with Telegram Cloud Storage. This provides the developer of the application utilities such as creating stamps on requests made by users, storing user API keys, storing temporary keys that are needed for decrypting credential bundles for activites like [email auth](https://docs.turnkey.com/features/email-auth) or [oauth](https://docs.turnkey.com/features/oauth), or storing arbitrary values that would be helpful to have saved for a user from session to session on device to device.

The Telegram Cloud Storage Stamper will, by default, store the API key used for signing in Telegram Cloud Storage under the key `TURNKEY_API_KEY`. A Cloud Storage "key" is the index under which a value is stored in Telegram Cloud Storage. This can be changed when using the `.create()` or `.setSigningKey()` functions. An API key is stored within Cloud Storage as a JSON string of the following object:

```
{
  apiPublicKey: "compressedApiPublicKeyHex",
  apiPrivateKey: "apiPrivateKeyHex",
}
```

#### Argument Usage

The `.create()` and `.setSigningKey()` functions take one of the following 4 sets of arguments:

- No arguments: Use an API key at the default location within Telegram Cloud Storage `TURNKEY_API_KEY` and set that as the signing key
- Just an API key: Store the passed in API key at the default Telegram Cloud Storage location and set that as the signing key
- Just a Cloud Storage key: Use an API key stored at the specified Telegram Cloud Storage key location and set that as the signing key
- Both an API key and a Cloud Storage key: Store the passed API key at the specified Telegram Cloud Storage key location and set that as the signing key

The `.getAPIKey()` and `.setAPIKey()` functions operate in a similar manner taking an optional `key` parameter that will be used to `get` or `set` the API key at that location if it is passed, or at the default location if it is not passed.

The following section will describe the usage of the helper functions provided for interfacing with Telegram Cloud Storage. These functions return null if there is no value when trying to retrieve an item from Cloud Storage.

### Usage

Insert a new API key into Telegram Cloud Storage at the default API key location

```ts
import TelegramCloudStorageStamper, { CloudStorageAPIKey } from "@turnkey/telegram-cloud-storage-stamper";
import { generateP256KeyPair } from "@turnkey/crypto";
import { TurnkeyBrowserClient, TurnkeySDKClientConfig } from "@turnkey/sdk-browser";

// generate an API keypair
const keyPair = generateP256KeyPair();

// the API key to be stored
const apiKey: CloudStorageAPIKey = {
  apiPublicKey: keyPair.publicKey,
  apiPrivateKey: keyPair.privateKey,
}

// create a new Telegram Cloud Storage Stamper
const stamper = await TelegramCloudStorageStamper.create({
  cloudStorageAPIKey: apiKey
})

// use the stamper in the client config
const browserConfig: TurnkeySDKClientConfig = {
  stamper: stamper,
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

Use an existing key that has been previously stored in Telegram Cloud Storage at the default API key location key location

```ts
import TelegramCloudStorageStamper from "@turnkey/telegram-cloud-storage-stamper";
import { TurnkeyBrowserClient, TurnkeySDKClientConfig } from "@turnkey/sdk-browser";

// create a new Telegram Cloud Storage stamper
const stamper = await TelegramCloudStorageStamper.create();

// use the stamper in the client config
const browserConfig: TurnkeySDKClientConfig = {
  stamper: stamper,
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

View an entry in Telegram Cloud Storage without inserting an API key, note the usage difference between the `new` and `.create()` here. `.create()` will do the work of getting/setting an API key in Cloud Storage whereas `new` will not

```ts
import TelegramCloudStorageStamper, {
  CloudStorageAPIKey,
} from "@turnkey/telegram-cloud-storage-stamper";

// create a new Telegram Cloud Storage Stamper, "new" is used when you don't want to store or retrieve any API keys, and just need an interface into Cloud Storage
const stamper = new TelegramCloudStorageStamper();

// the key used to index Telegram Cloud Storage
const telegramCloudStorageKey = "@turnkey/telegramCloudStorageKey";

// get the item stored in Telegram Cloud Storage returned as a string
const item = await stamper.getItem(telegramCloudStorageKey);

if (!item) {
  // failed retrieving item
}
```

Insert a new API key into Cloud Storage at a specified key. This is just storing an API key, without using `.setSigningKey()` the key will not be used for signing.

```ts
import TelegramCloudStorageStamper from "@turnkey/telegram-cloud-storage-stamper";

// create a new Telegram Cloud Storage Stamper
const stamper = new TelegramCloudStorageStamper();

const apiPublicKey = "...";
const apiPrivateKey = "...";

// the key used to index Telegram Cloud Storage
const telegramCloudStorageKey = "@turnkey/telegramCloudStorageKey";

// insert the API key in Telegram Cloud Storage
await stamper.insertAPIKey(
  apiPublicKey,
  apiPrivateKey,
  telegramCloudStorageKey,
);
```

Set a new API key as the signing key for the stamper at a specified key. This will also insert the API key to that location within Telegram CloudStorage. Any subsequent requests for stamping will sign with this API key. The API key and CloudStorage key can also be omitted and the API key at the default location `TURNKEY_API_KEY` will be used. If an API key is omitted and a CloudStorage key is specified an API key at that location will be used. Refer to the [argument-usage](#argument-usage) section for a full explanation. A stamper that was originally used to just view Cloud Storage values can later be used for signing by using the `.setSigningKey()` function.

```ts
import TelegramCloudStorageStamper, {
  CloudStorageAPIKey,
} from "@turnkey/telegram-cloud-storage-stamper";

// the API key to be set as the signing key
const apiKey: CloudStorageAPIKey = {
  apiPublicKey: "...",
  apiPrivateKey: "...",
};

// create a new Telegram Cloud Storage Stamper
const stamper = new TelegramCloudStorageStamper();

// the key used to index Telegram Cloud Storage
const telegramCloudStorageKey = "@turnkey/telegramCloudStorageKey";

// insert the API key in Telegram Cloud Storage
await stamper.setSigningKey({
  cloudStorageAPIKey: apiKey,
  cloudStorageKey: telegramCloudStorageKey,
});
```

Set a new API key as the signing key for the stamper that previously had a different key set for the stamper.

```ts
import TelegramCloudStorageStamper, {
  CloudStorageAPIKey,
} from "@turnkey/telegram-cloud-storage-stamper";

// the API key to be stored
const apiKey: CloudStorageAPIKey = {
  apiPublicKey: "...",
  apiPrivateKey: "...",
};

// the API key to be set as the signing key
const stamper = await TelegramCloudStorageStamper.create({
  cloudStorageAPIKey: apiKey,
});

const apiKey2: CloudStorageAPIKey = {
  apiPublicKey: "...",
  apiPrivateKey: "...",
};

// insert the API key in Telegram Cloud Storage
await stamper.setSigningKey({
  cloudStorageAPIKey: apiKey2,
});
```
