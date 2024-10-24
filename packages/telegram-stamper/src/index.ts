/// <reference lib="dom" />
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TelegramStamperError } from "./errors";

declare global {
  interface Window {
    Telegram: any;
  }
}

// config when telegram stamper is passed in an api key
export type TTelegramStamperConfig = {
  apiPublicKey: string;
  apiPrivateKey: string;
  cloudStorageKey?: string;
};

type CloudStorageAPIKey = {
  apiPublicKey: string;
  apiPrivateKey: string;
};

// Constant for default key name
const DEFAULT_TURNKEY_CLOUD_STORAGE_KEY = "TURNKEY_API_KEY";

/**
 * Stamper to use within a `TurnkeyClient`
 */
export default class TelegramStamper {
  // This stamper uses a typical apikey stamper under the hood and abstracts away the storage of the actual api keys
  stamper: ApiKeyStamper | undefined;
  cloudStorageKey: string | undefined;

  private constructor(config: TTelegramStamperConfig) {
    // check to see if were in a telegram mini app context
    TelegramStamper.checkTelegramContext();

    // instantiate the stamper
    this.stamper = new ApiKeyStamper({
      apiPublicKey: config.apiPublicKey,
      apiPrivateKey: config.apiPrivateKey,
    });

    // set the cloud storage key
    this.cloudStorageKey = config.cloudStorageKey;
  }

  // create a telegram stamper by getting/setting the private/public api key values from/to telegram cloud storage
  static async create(
    config?: TTelegramStamperConfig
  ): Promise<TelegramStamper> {
    // check to see if were in a telegram mini app context
    TelegramStamper.checkTelegramContext();

    let cloudStorageKey = DEFAULT_TURNKEY_CLOUD_STORAGE_KEY;
    let apiPublicKey = "";
    let apiPrivateKey = "";

    // set the api pub and priv key if config is passed in
    if (config) {
      apiPublicKey = config.apiPublicKey;
      apiPrivateKey = config.apiPrivateKey;
      if (config.cloudStorageKey) {
        // set the cloud storage key if it is passed in
        cloudStorageKey = config.cloudStorageKey;
      }

      try {
        await TelegramStamper.setCloudStorageItem(
          cloudStorageKey,
          TelegramStamper.stringifyAPIKey(
            config.apiPublicKey,
            config.apiPrivateKey
          )
        );
      } catch (e) {
        throw new TelegramStamperError(
          `Failed storing api key in Telegram Cloud Storage`
        );
      }
    } else {
      try {
        const apiKey = await TelegramStamper.getCloudStorageItem(
          cloudStorageKey
        );
        ({ apiPublicKey, apiPrivateKey } = TelegramStamper.parseAPIKey(apiKey));

        if (!apiPublicKey || !apiPrivateKey) {
          throw new TelegramStamperError(
            "Failed parsing API key from Telegram Cloud Storage"
          );
        }
      } catch (e) {
        throw new TelegramStamperError(
          "Failed getting API key from Telegram Cloud Storage"
        );
      }
    }

    return new TelegramStamper({
      apiPublicKey,
      apiPrivateKey,
      cloudStorageKey,
    });
  }

  async stamp(payload: string) {
    // check to see if were in a telegram mini app context
    TelegramStamper.checkTelegramContext();

    console.log(this.stamper?.apiPrivateKey)
    console.log(this.stamper?.apiPublicKey)

    // check to see that the stamper was initialized
    if (!this.stamper) {
      throw new TelegramStamperError(
        "Cannot stamp with unintialized telegram stamper, call TelegramStamper.init()"
      );
    }

    return await this.stamper.stamp(payload);
  }

  // clear key from telegram cloud storage
  async clearKey(key: string) {
    // check to see if were in a telegram mini app context
    TelegramStamper.checkTelegramContext();

    await window.Telegram.WebApp.CloudStorage.removeItem(
      key,
      (err: any, removed: boolean) => {
        if (err || !removed) {
          throw new TelegramStamperError(
            `Failed removing key: ${key}${err && `: ${err}`}`
          );
        }
      }
    );
  }

  static checkTelegramContext() {
    if (window?.Telegram?.WebApp?.CloudStorage == null) {
      throw new TelegramStamperError(
        "Cannot use telegram stamper in non telegram mini-app environment, window.Telegram.WebApp.CloudStorage is not defined"
      );
    }
  }

  static stringifyAPIKey(apiPublicKey: string, apiPrivateKey: string) {
    return JSON.stringify({
      apiPublicKey,
      apiPrivateKey,
    });
  }

  static parseAPIKey(apiKey: string) {
    try {
      const parsedApiKey = JSON.parse(apiKey);

      if (!TelegramStamper.isApiKey(parsedApiKey)) {
        return {
          apiPublicKey: "",
          apiPrivateKey: "",
        };
      }

      return {
        apiPublicKey: parsedApiKey.apiPublicKey,
        apiPrivateKey: parsedApiKey.apiPrivateKey,
      };
    } catch (err) {
      throw new TelegramStamperError(
        "Failed parsing API key from Telegram Cloud Storage"
      );
    }
  }

  static isApiKey(apiKey: CloudStorageAPIKey) {
    return (
      typeof apiKey.apiPublicKey === "string" &&
      typeof apiKey.apiPrivateKey === "string"
    );
  }

  static async getCloudStorageItem(key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      window.Telegram.WebApp.CloudStorage.getItem(
        key,
        (err: any, apiKey: string) => {
          if (err != null || !apiKey) {
            reject(
              new TelegramStamperError(
                `Failed getting key: ${key} from Telegram Cloud Storage${
                  err && `: ${err}`
                }`
              )
            );
          }

          resolve(apiKey);
        }
      );
    });
  }

  static async setCloudStorageItem(key: string, value: string) {
    return new Promise((resolve, reject) => {
      window.Telegram.WebApp.CloudStorage.setItem(
        key,
        value,
        (err: any, stored: boolean) => {
          if (err != null || !stored) {
            reject(
              new TelegramStamperError(
                `Failed inserting value: ${value} into Telegram Cloud Storage at key: ${key}${
                  err && `: ${err}`
                }`
              )
            );
          }

          resolve(stored);
        }
      );
    });
  }
}
