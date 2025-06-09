import type { Session } from "@turnkey/sdk-types";
import WindowWrapper from "@polyfills/window";

import { StorageBase, StorageKey, StorageValue } from "../base";

const browserStorage = WindowWrapper.localStorage;

export class WebStorageManager implements StorageBase {
  // TODO (Amir): try catch
  getStorageValue = async <K extends StorageKey>(
    storageKey: K,
  ): Promise<StorageValue[K] | undefined> => {
    const storageItem = browserStorage.getItem(storageKey);
    return storageItem ? JSON.parse(storageItem) : undefined;
  };

  setStorageValue = async <K extends StorageKey>(
    storageKey: K,
    storageValue: StorageValue[K],
  ): Promise<any> => {
    browserStorage.setItem(storageKey, JSON.stringify(storageValue));
  };

  removeStorageValue = async <K extends StorageKey>(
    storageKey: K,
  ): Promise<void> => {
    browserStorage.removeItem(storageKey);
  };

  storeSession = async (session: Session): Promise<any> => {
    return await this.setStorageValue(StorageKey.Session, session);
  };
}
