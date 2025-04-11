import WindowWrapper from "@polyfills/window";
import type {
  AuthClient,
  Session,
  User,
  ReadWriteSession,
  TSessionResponse,
} from "./__types__/base";

export enum StorageKeys {
  AuthBundle = "@turnkey/auth_bundle", // DEPRECATED
  CurrentUser = "@turnkey/current_user", // DEPRECATED
  UserSession = "@turnkey/session/v1", // DEPRECATED
  ReadWriteSession = "@turnkey/read_write_session", // DEPREACTED
  Session = "@turnkey/session/v2",
  Client = "@turnkey/client",
}

interface StorageValue {
  [StorageKeys.AuthBundle]: string; // DEPRECATED
  [StorageKeys.CurrentUser]: User; // DEPRECATED
  [StorageKeys.UserSession]: User; // DEPRECATED
  [StorageKeys.ReadWriteSession]: ReadWriteSession; // DEPRECATED
  [StorageKeys.Session]: Session;
  [StorageKeys.Client]: AuthClient;
}

enum StorageLocation {
  Local = "local",
  Secure = "secure",
  Session = "session",
}

const STORAGE_VALUE_LOCATIONS: Record<StorageKeys, StorageLocation> = {
  [StorageKeys.AuthBundle]: StorageLocation.Secure,
  [StorageKeys.CurrentUser]: StorageLocation.Local,
  [StorageKeys.ReadWriteSession]: StorageLocation.Secure,
  [StorageKeys.UserSession]: StorageLocation.Session,
  [StorageKeys.Session]: StorageLocation.Session,
  [StorageKeys.Client]: StorageLocation.Session,
};

const STORAGE_LOCATIONS = {
  [StorageLocation.Local]: WindowWrapper.localStorage,
  [StorageLocation.Secure]: WindowWrapper.localStorage,
  [StorageLocation.Session]: WindowWrapper.localStorage,
};

export const getStorageValue = <K extends StorageKeys>(
  storageKey: K
): StorageValue[K] | undefined => {
  const storageLocation: StorageLocation = STORAGE_VALUE_LOCATIONS[storageKey];
  const browserStorageLocation: Storage = STORAGE_LOCATIONS[storageLocation];
  const storageItem = browserStorageLocation.getItem(storageKey);
  return storageItem ? JSON.parse(storageItem) : undefined;
};

export const setStorageValue = <K extends StorageKeys>(
  storageKey: K,
  storageValue: StorageValue[K]
): void => {
  const storageLocation: StorageLocation = STORAGE_VALUE_LOCATIONS[storageKey];
  const browserStorageLocation: Storage = STORAGE_LOCATIONS[storageLocation];
  browserStorageLocation.setItem(storageKey, JSON.stringify(storageValue));
};

export const removeStorageValue = <K extends StorageKeys>(
  storageKey: K
): void => {
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

export const storeSession = (session: Session, client?: AuthClient) => {
  setStorageValue(StorageKeys.Session, session);
  if (client) {
    setStorageValue(StorageKeys.Client, client);
  }
};

/**
 * Saves a user session to storage.
 *
 * @param {TSessionResponse} sessionResponse - The session response containing session details.
 * @param {AuthClient} authClient - The authentication client used for the session.
 * @throws Will throw an error if the authentication client is not set.
 */
export const saveSession = (
  {
    organizationId,
    organizationName,
    sessionExpiry,
    credentialBundle,
    userId,
    username,
    ...sessionResponse
  }: TSessionResponse,
  authClient?: AuthClient,
): void => {
  if (!authClient) {
    throw new Error("Failed to save session: Authentication client not set");
  }

  const expiry = Number(sessionExpiry);
  const session = credentialBundle
    ? {
        write: {
          credentialBundle,
          expiry,
        },
      }
    : {
        read: {
          token: sessionResponse.session!,
          expiry,
        },
      };

  const userSession: User = {
    userId,
    username,
    organization: {
      organizationId,
      organizationName,
    },
    session: {
      authClient,
      ...session,
    },
  };

  setStorageValue(StorageKeys.UserSession, userSession);
};
