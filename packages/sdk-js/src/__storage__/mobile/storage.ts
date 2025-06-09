import type { Session } from "@turnkey/sdk-types";

import { StorageBase, StorageKey, StorageValue } from "../base";

export class MobileStorageManager implements StorageBase {
  Keychain = require("react-native-keychain");

  getStorageValue = async <K extends StorageKey>(
    storageKey: K,
  ): Promise<StorageValue[K] | undefined> => {
    try {
      const result = await this.Keychain.getGenericPassword({
        service: storageKey,
      });

      if (result && result.password) {
        return JSON.parse(result.password);
      }
      return undefined;
    } catch (error) {
      console.error("Error retrieving from Keychain:", error);
      return undefined;
    }
  };

  setStorageValue = async <K extends StorageKey>(
    storageKey: K,
    storageValue: StorageValue[K],
  ): Promise<boolean> => {
    try {
      const result = await this.Keychain.setGenericPassword(
        storageKey,
        JSON.stringify(storageValue),
        { service: storageKey },
      );
      return !!result;
    } catch (error) {
      console.error("Error storing in Keychain:", error);
      return false;
    }
  };

  removeStorageValue = async <K extends StorageKey>(
    storageKey: K,
  ): Promise<void> => {
    try {
      await this.Keychain.resetGenericPassword({
        service: storageKey,
      });
    } catch (error) {
      console.error("Error removing from Keychain:", error);
    }
  };

  storeSession = async (session: Session): Promise<boolean> => {
    return await this.setStorageValue(StorageKey.Session, session);
  };
}
