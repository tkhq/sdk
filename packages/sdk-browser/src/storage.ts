import type { User, ReadWriteSession } from "./models";
import WindowWrapper from "./__polyfills__/window";

export enum StorageKeys {
  AuthBundle = "@turnkey/auth_bundle", // LEGACY
  CurrentUser = "@turnkey/current_user",
  ReadWriteSession = "@turnkey/read_write_session"
}

interface StorageValue {
  [StorageKeys.AuthBundle]: string; // LEGACY
  [StorageKeys.CurrentUser]: User;
  [StorageKeys.ReadWriteSession]: ReadWriteSession;
}

enum StorageLocation {
  Local = "local",
  Secure = "secure",
  Session = "session",
}

const STORAGE_VALUE_LOCATIONS: Record<StorageKeys, StorageLocation> = {
  [StorageKeys.AuthBundle]: StorageLocation.Secure,
  [StorageKeys.CurrentUser]: StorageLocation.Local,
  [StorageKeys.ReadWriteSession]: StorageLocation.Secure
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
