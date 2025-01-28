/// <reference lib="dom" />
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import {
  TelegramCloudStorageStamperError,
  TelegramSuccessButFalseError,
} from "./errors";

declare global {
  interface Window {
    Telegram: any;
  }
}

// config when telegram stamper is passed in an API key
export type TTelegramCloudStorageStamperConfig = {
  cloudStorageAPIKey?: CloudStorageAPIKey;
  cloudStorageKey?: string;
};

export type CloudStorageAPIKey = {
  apiPublicKey: string;
  apiPrivateKey: string;
};

// Constant for default key name
const DEFAULT_TURNKEY_CLOUD_STORAGE_KEY = "TURNKEY_API_KEY";

/**
 * Stamper to use within a `TurnkeyClient`
 */
export default class TelegramCloudStorageStamper {
  // This stamper uses a typical @turnkey/api-key-stamper under the hood and abstracts away the storage of the actual API keys
  stamper?: ApiKeyStamper | undefined;

  // the constructor checks if we're in a telegram mini app context, and then gives the developer an interface into looking into CloudStorage even without having an API key attached
  constructor() {
    // check to see if we're in a telegram mini app context
    this.checkTelegramContext();
  }

  // create a telegram stamper by getting/setting the private/public API key values from/to telegram cloud storage
  static async create(config?: TTelegramCloudStorageStamperConfig) {
    let telegramStamper = new TelegramCloudStorageStamper();

    await telegramStamper.setSigningKey(config);

    return telegramStamper;
  }

  async stamp(payload: string) {
    // check to see if we're in a telegram mini app context
    this.checkTelegramContext();

    // check to see that the stamper was initialized
    if (!this.stamper) {
      throw new TelegramCloudStorageStamperError(
        "Cannot stamp with uninitialized telegram stamper, try running .create() or .setSigningKey()",
      );
    }

    return await this.stamper.stamp(payload);
  }

  // set the API key that is used by the telegram cloud storage for signing requests
  async setSigningKey(config?: TTelegramCloudStorageStamperConfig) {
    if (!config) {
      // try to get API key at default location and set the stamper to use that
      // passing the DEFAULT_TURNKEY_CLOUD_STORAGE_KEY is not necessary since getAPIKey will use that by default
      let { apiPublicKey, apiPrivateKey } =
        (await this.getAPIKey(DEFAULT_TURNKEY_CLOUD_STORAGE_KEY)) ?? {};

      if (apiPublicKey && apiPrivateKey) {
        this.stamper = new ApiKeyStamper({
          apiPublicKey,
          apiPrivateKey,
        });
        return;
      }
    } else if (config.cloudStorageKey && !config.cloudStorageAPIKey) {
      // try to get API key at specified location and set the stamper to use that
      let { apiPublicKey, apiPrivateKey } =
        (await this.getAPIKey(config.cloudStorageKey)) ?? {};

      if (apiPublicKey && apiPrivateKey) {
        this.stamper = new ApiKeyStamper({
          apiPublicKey,
          apiPrivateKey,
        });
        return;
      }
    } else if (!config.cloudStorageKey && config.cloudStorageAPIKey) {
      // try to set API key at default location and set the stamper to use that
      // passing the DEFAULT_TURNKEY_CLOUD_STORAGE_KEY is not necessary since insertAPIKey will use that by default
      await this.insertAPIKey(
        config.cloudStorageAPIKey.apiPublicKey,
        config.cloudStorageAPIKey.apiPrivateKey,
        DEFAULT_TURNKEY_CLOUD_STORAGE_KEY,
      );

      this.stamper = new ApiKeyStamper({
        apiPublicKey: config.cloudStorageAPIKey.apiPublicKey,
        apiPrivateKey: config.cloudStorageAPIKey.apiPrivateKey,
      });
      return;
    } else if (config.cloudStorageKey && config.cloudStorageAPIKey) {
      // try to set API key at specified location and set the stamper to use that
      await this.insertAPIKey(
        config.cloudStorageAPIKey.apiPublicKey,
        config.cloudStorageAPIKey.apiPrivateKey,
        config.cloudStorageKey,
      );

      this.stamper = new ApiKeyStamper({
        apiPublicKey: config.cloudStorageAPIKey.apiPublicKey,
        apiPrivateKey: config.cloudStorageAPIKey.apiPrivateKey,
      });
      return;
    }
    throw new TelegramCloudStorageStamperError(
      "Invalid configuration received for signing key",
    );
  }

  async insertAPIKey(
    apiPublicKey: string,
    apiPrivateKey: string,
    key: string = DEFAULT_TURNKEY_CLOUD_STORAGE_KEY,
  ) {
    return await this.setItem(
      key,
      this.stringifyAPIKey(apiPublicKey, apiPrivateKey),
    );
  }

  async getAPIKey(
    key: string = DEFAULT_TURNKEY_CLOUD_STORAGE_KEY,
  ): Promise<CloudStorageAPIKey | null> {
    try {
      const apiKey = await this.getItem(key);

      if (!apiKey) {
        return null;
      }

      return this.parseAPIKey(apiKey as string);
    } catch {
      return null;
    }
  }

  checkTelegramContext() {
    if (window?.Telegram?.WebApp?.CloudStorage == null) {
      throw new TelegramCloudStorageStamperError(
        "Cannot use telegram stamper in non telegram mini-app environment, window.Telegram.WebApp.CloudStorage is not defined",
      );
    }
  }

  stringifyAPIKey(apiPublicKey: string, apiPrivateKey: string) {
    return JSON.stringify({
      apiPublicKey,
      apiPrivateKey,
    });
  }

  parseAPIKey(apiKey: string) {
    try {
      const parsedApiKey = JSON.parse(apiKey);

      if (!this.isCloudStorageAPIKey(parsedApiKey)) {
        return null;
      }

      return {
        apiPublicKey: parsedApiKey.apiPublicKey,
        apiPrivateKey: parsedApiKey.apiPrivateKey,
      };
    } catch (err) {
      throw new TelegramCloudStorageStamperError(
        "Failed parsing API key from Telegram Cloud Storage",
      );
    }
  }

  // determines if a passed object is of type CloudStorageAPIKey
  isCloudStorageAPIKey(apiKey: CloudStorageAPIKey) {
    return (
      typeof apiKey.apiPublicKey === "string" &&
      typeof apiKey.apiPrivateKey === "string"
    );
  }

  async getItem(key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      window.Telegram.WebApp.CloudStorage.getItem(
        key,
        (err: any, value: string) => {
          if (err != null) {
            reject(
              new TelegramCloudStorageStamperError(
                `Failed getting value: ${key} from Telegram Cloud Storage${
                  err && `: ${err}`
                }`,
              ),
            );
          }

          resolve(value);
        },
      );
    });
  }

  async setItem(key: string, value: string) {
    return new Promise<void>((resolve, reject) => {
      window.Telegram.WebApp.CloudStorage.setItem(
        key,
        value,
        (err: any, stored: boolean) => {
          if (err != null) {
            reject(
              new TelegramCloudStorageStamperError(
                `Failed inserting value: ${value} into Telegram Cloud Storage at key: ${key}${
                  err && `: ${err}`
                }`,
              ),
            );
          }
          if (!stored) {
            reject(
              new TelegramSuccessButFalseError(
                "Telegram indicated success for storing key, but also returned false, see documention: https://core.telegram.org/bots/webapps#cloudstorage",
              ),
            );
          }

          resolve();
        },
      );
    });
  }

  // clear key from telegram cloud storage
  async clearItem(key: string) {
    // check to see if we're in a telegram mini app context
    this.checkTelegramContext();

    return new Promise<void>((resolve, reject) => {
      window.Telegram.WebApp.CloudStorage.removeItem(
        key,
        (err: any, removed: boolean) => {
          if (err) {
            reject(
              new TelegramCloudStorageStamperError(
                `Failed removing key: ${key}${err && `: ${err}`}`,
              ),
            );
          }
          if (!removed) {
            reject(
              new TelegramSuccessButFalseError(
                "Telegram indicated success for removing key, but also returned false, see documention: https://core.telegram.org/bots/webapps#cloudstorage",
              ),
            );
          }

          resolve();
        },
      );
    });
  }
}
