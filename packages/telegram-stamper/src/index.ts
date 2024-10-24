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

  constructor(config?: TTelegramStamperConfig) {
    // check to see if were in a telegram mini app context
    this.checkTelegramContext();

    // check the type of config that was passed in to the constructor
    if (config) {
      // if a public/private api key was passed in instantiate the stamper
      this.stamper = new ApiKeyStamper({
        apiPublicKey: config.apiPublicKey,
        apiPrivateKey: config.apiPrivateKey,
      });

      // set the cloud storage key
      if (config.cloudStorageKey) {
        this.cloudStorageKey = config.cloudStorageKey;
      } else {
        this.cloudStorageKey = DEFAULT_TURNKEY_CLOUD_STORAGE_KEY;
      }
    }
  }

  // initialize the telegram stamper by getting/setting the private/public api key values from/to telegram cloud storage
  async init() {
    // check to see if were in a telegram mini app context
    this.checkTelegramContext();

    if (this.stamper) {
      // insert creds into telegram cloud storage
      await window.Telegram.WebApp.CloudStorage.setItem(
        this.cloudStorageKey,
        this.stringifyAPIKey(),
        (err: any, stored: boolean) => {
          if (err != null || !stored) {
            throw new TelegramStamperError(
              `Failed inserting API key into Telegram Cloud Storage${
                err && `: ${err}`
              }`
            );
          }
        }
      );
    } else {
      // attempt to get creds from telegram cloud storage
      await window.Telegram.WebApp.CloudStorage.getItem(
        this.cloudStorageKey,
        (err: any, apiKey: string) => {
          if (err != null || !apiKey) {
            throw new TelegramStamperError(
              `Failed getting API key from Telegram Cloud Storage${
                err && `: ${err}`
              }`
            );
          }

          const { parsedPublicKey, parsedPrivateKey } =
            this.parseAPIKey(apiKey);

          // ToDo: api key validation, how does apikeystamper validate creds passed to it?'

          if (!parsedPublicKey || !parsedPrivateKey) {
            throw new TelegramStamperError(
              "Failed parsing API key from Telegram Cloud Storage"
            );
          }

          // instantiate api key stamper
          this.stamper = new ApiKeyStamper({
            apiPublicKey: parsedPublicKey,
            apiPrivateKey: parsedPrivateKey,
          });
        }
      );
    }
  }

  async stamp(payload: string) {
    // check to see if were in a telegram mini app context
    this.checkTelegramContext();

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
    this.checkTelegramContext();

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

  checkTelegramContext() {
    if (window?.Telegram?.WebApp?.CloudStorage == null) {
      throw new TelegramStamperError(
        "Cannot use telegram stamper in non telegram mini-app environment, window.Telegram.WebApp.CloudStorage is not defined"
      );
    }
  }

  stringifyAPIKey() {
    return JSON.stringify({
      apiPublicKey: this.stamper?.apiPublicKey,
      apiPrivateKey: this.stamper?.apiPrivateKey,
    });
  }

  parseAPIKey(apiKey: string) {
    try {
      const parsedApiKey = JSON.parse(apiKey);

      if (!this.isApiKey(parsedApiKey)) {
        return {
          parsedPublicKey: "",
          parsedPrivateKey: "",
        };
      }

      return {
        parsedPublicKey: parsedApiKey.apiPublicKey,
        parsedPrivateKey: parsedApiKey.apiPrivateKey,
      };
    } catch (err) {
      throw new TelegramStamperError(
        "Failed parsing API key from Telegram Cloud Storage"
      );
    }
  }

  isApiKey(apiKey: CloudStorageAPIKey) {
    return (
      typeof apiKey.apiPublicKey === "string" &&
      typeof apiKey.apiPrivateKey === "string"
    );
  }
}
