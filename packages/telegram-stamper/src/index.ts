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
};

const PUBLIC_KEY_CLOUD_STORAGE_KEY = "TURNKEY_API_PUBLIC_KEY";
const PRIVATE_KEY_CLOUD_STORAGE_KEY = "TURNKEY_API_PRIVATE_KEY";

/**
 * Stamper to use with `@turnkey/http`'s `TurnkeyClient`
 */
export default class TelegramStamper {
  stamper: ApiKeyStamper | undefined;

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
    }
  }

  // initialize the telegram stamper by getting/setting the private/public api key values from/to telegram cloud storage
  async init() {
    // check to see if were in a telegram mini app context
    this.checkTelegramContext();

    if (this.stamper) {
      // insert creds into telegram cloud storage
      // insert public key
      await window.Telegram.WebApp.CloudStorage.setItem(
        PUBLIC_KEY_CLOUD_STORAGE_KEY,
        this.stamper.apiPublicKey,
        (err: any, stored: boolean) => {
          if (err != null || !stored) {
            throw new TelegramStamperError(
              `Failed inserting api public key into Telegram Cloud Storage${
                err && `: ${err}`
              }`
            );
          }
        }
      );

      // insert private key
      await window.Telegram.WebApp.CloudStorage.setItem(
        PRIVATE_KEY_CLOUD_STORAGE_KEY,
        this.stamper.apiPrivateKey,
        (err: any, stored: boolean) => {
          if (err != null || !stored) {
            // remove public key from storage if private key could not be stored
            try {
              this.clearKey(PUBLIC_KEY_CLOUD_STORAGE_KEY);
            } catch (err) {
              console.log(
                `Failed removing public key from Telegram Cloud Storage stored at: ${PUBLIC_KEY_CLOUD_STORAGE_KEY}`
              );
            }
            throw new TelegramStamperError(
              `Failed inserting api private key into Telegram Cloud Storage${
                err && `: ${err}`
              }`
            );
          }
        }
      );
    } else {
      // attempt to get creds from telegram cloud storage
      let obtainedPublicKey = "";
      let obtainedPrivateKey = "";

      // get public key
      await window.Telegram.WebApp.CloudStorage.getItem(
        PUBLIC_KEY_CLOUD_STORAGE_KEY,
        (err: any, pubKey: string) => {
          if (err != null || !pubKey) {
            throw new TelegramStamperError(
              `Failed getting api public key from Telegram Cloud Storage${
                err && `: ${err}`
              }`
            );
          }

          obtainedPublicKey = pubKey;
        }
      );

      // get private key
      await window.Telegram.WebApp.CloudStorage.getItem(
        PUBLIC_KEY_CLOUD_STORAGE_KEY,
        (err: any, privKey: string) => {
          if (err != null || !privKey) {
            throw new TelegramStamperError(
              `Failed getting api public key from Telegram Cloud Storage${
                err && `: ${err}`
              }`
            );
          }

          obtainedPrivateKey = privKey;
        }
      );

      // ToDo: api key validation, how does apikeystamper validate creds passed to it?

      // instantiate api key stamper
      this.stamper = new ApiKeyStamper({
        apiPublicKey: obtainedPublicKey,
        apiPrivateKey: obtainedPrivateKey,
      });
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
    if (window?.Telegram?.WebApp == null) {
      throw new TelegramStamperError(
        "Cannot use telegram stamper in non telegram mini-app environment"
      );
    }
  }
}
