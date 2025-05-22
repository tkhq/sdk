import WindowWrapper from "@polyfills/window";
import type { AuthClient, Session } from "./__types__/base";

export enum StorageKeys {
  Session = "@turnkey/session/v2",
  Client = "@turnkey/client",
}

interface StorageValue {
  [StorageKeys.Session]: string | Session;
  [StorageKeys.Client]: AuthClient;
}

enum StorageLocation {
  Local = "local",
  Secure = "secure",
  Session = "session",
}

const STORAGE_VALUE_LOCATIONS: Record<StorageKeys, StorageLocation> = {
  [StorageKeys.Session]: StorageLocation.Session,
  [StorageKeys.Client]: StorageLocation.Session,
};

const STORAGE_LOCATIONS = {
  [StorageLocation.Local]: WindowWrapper.localStorage,
  [StorageLocation.Secure]: WindowWrapper.localStorage,
  [StorageLocation.Session]: WindowWrapper.localStorage,
};

export const getStorageValue = async <K extends StorageKeys>(
  storageKey: K,
): Promise<StorageValue[K] | undefined> => {
  const storageLocation: StorageLocation = STORAGE_VALUE_LOCATIONS[storageKey];
  const browserStorageLocation: Storage = STORAGE_LOCATIONS[storageLocation];
  const storageItem = browserStorageLocation.getItem(storageKey);
  return storageItem ? JSON.parse(storageItem) : undefined;
};

export const setStorageValue = async <K extends StorageKeys>(
  storageKey: K,
  storageValue: StorageValue[K],
): Promise<any> => {
  const storageLocation: StorageLocation = STORAGE_VALUE_LOCATIONS[storageKey];
  const browserStorageLocation: Storage = STORAGE_LOCATIONS[storageLocation];
  browserStorageLocation.setItem(storageKey, JSON.stringify(storageValue));
};

export const removeStorageValue = async <K extends StorageKeys>(
  storageKey: K,
): Promise<void> => {
  const storageLocation: StorageLocation = STORAGE_VALUE_LOCATIONS[storageKey];
  const browserStorageLocation: Storage = STORAGE_LOCATIONS[storageLocation];
  browserStorageLocation.removeItem(storageKey);
};

/**
 * Saves a session and client to storage.
 *
 * @param {Session} session - The session response containing session details.
 * @param {AuthClient} authClient - The authentication client used for the session.
 * @throws Will throw an error if the authentication client is not set.
 * @returns {Promise<void>} A promise that resolves when the session is saved.
 */

export const storeSession = async (
  session: string | Session,
  client?: AuthClient,
) => {
  await setStorageValue(StorageKeys.Session, session);
  if (client) {
    await setStorageValue(StorageKeys.Client, client);
  }
};
