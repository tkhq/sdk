import type { User, SigningSession } from "./models";
import WindowWrapper from "./__polyfills__/window";

export enum StorageKeys {
  CurrentUser = "@turnkey/current_user",
  SigningSession = "@turnkey/signing_session"
}

interface StorageValue {
  [StorageKeys.CurrentUser]: User;
  [StorageKeys.SigningSession]: SigningSession;
}

enum StorageLocation {
  Local = "local",
  Secure = "secure",
  Session = "session",
}

const STORAGE_VALUE_LOCATIONS: Record<StorageKeys, StorageLocation> = {
  [StorageKeys.CurrentUser]: StorageLocation.Local,
  [StorageKeys.SigningSession]: StorageLocation.Secure
};

const STORAGE_LOCATIONS = {
  [StorageLocation.Local]: WindowWrapper.localStorage,
  [StorageLocation.Secure]: WindowWrapper.localStorage,
  [StorageLocation.Session]: WindowWrapper.localStorage,
};

export const getStorageValue = async <K extends StorageKeys>(
  storageKey: K
): Promise<StorageValue[K] | undefined> => {
  const storageLocation: StorageLocation = STORAGE_VALUE_LOCATIONS[storageKey];
  const browserStorageLocation: Storage = STORAGE_LOCATIONS[storageLocation];
  const storageItem = browserStorageLocation.getItem(storageKey);
  return storageItem ? JSON.parse(storageItem) : undefined;
};

export const setStorageValue = async <K extends StorageKeys>(
  storageKey: K,
  storageValue: StorageValue[K]
): Promise<any> => {
  const storageLocation: StorageLocation = STORAGE_VALUE_LOCATIONS[storageKey];
  const browserStorageLocation: Storage = STORAGE_LOCATIONS[storageLocation];
  browserStorageLocation.setItem(storageKey, JSON.stringify(storageValue));
};

export const removeStorageValue = async <K extends StorageKeys>(
  storageKey: K
): Promise<void> => {
  const storageLocation: StorageLocation = STORAGE_VALUE_LOCATIONS[storageKey];
  const browserStorageLocation: Storage = STORAGE_LOCATIONS[storageLocation];
  browserStorageLocation.removeItem(storageKey);
};
