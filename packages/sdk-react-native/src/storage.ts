import * as Keychain from "react-native-keychain";
import { TurnkeyReactNativeError } from "./errors";
import type { Session } from "./types";
import { StorageKeys } from "./constants";

/**
 * Retrieves the stored embedded key from secure storage.
 * Optionally deletes the key from storage after retrieval.
 *
 * @param deleteKey Whether to remove the embedded key after retrieval. Defaults to `false`.
 * @returns The embedded private key if found, otherwise `null`.
 * @throws If retrieving or deleting the key fails.
 */
export const getEmbeddedKey = async (
  deleteKey = false,
): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: StorageKeys.EmbeddedKey,
    });

    if (credentials) {
      if (deleteKey) {
        await Keychain.resetGenericPassword({
          service: StorageKeys.EmbeddedKey,
        });
      }
      return credentials.password;
    }
    return null;
  } catch (error) {
    throw new TurnkeyReactNativeError("Failed to get embedded key", error);
  }
};

/**
 * Saves the private key component of an embedded key securely in storage.
 *
 * @param key The private key to store securely.
 * @throws If saving the key fails.
 */
export const saveEmbeddedKey = async (key: string): Promise<void> => {
  try {
    await Keychain.setGenericPassword(StorageKeys.EmbeddedKey, key, {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: StorageKeys.EmbeddedKey,
    });
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Could not save the embedded key.",
      error,
    );
  }
};

/**
 * Retrieves a stored session from secure storage.
 *
 * @param sessionKey The unique key identifying the session.
 * @returns The session object if found, otherwise `null`.
 * @throws If retrieving the session fails.
 */
export const getSession = async (
  sessionKey: string,
): Promise<Session | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: sessionKey,
    });

    return credentials ? JSON.parse(credentials.password) : null;
  } catch (error) {
    throw new TurnkeyReactNativeError(
      `Failed to get session for sessionKey "${sessionKey}"`,
      error,
    );
  }
};

/**
 * Saves a session securely in storage.
 *
 * @param session The session object to store securely.
 * @param sessionKey The unique key under which the session is stored.
 * @throws If saving the session fails.
 */
export const saveSession = async (
  session: Session,
  sessionKey: string,
): Promise<void> => {
  try {
    await Keychain.setGenericPassword(sessionKey, JSON.stringify(session), {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: sessionKey,
    });
  } catch (error) {
    throw new TurnkeyReactNativeError("Could not save the session", error);
  }
};

/**
 * Deletes a session from secure storage.
 *
 * @param sessionKey The unique key identifying the session to reset.
 * @throws If deleting the session fails.
 */
export const deleteSession = async (sessionKey: string): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({ service: sessionKey });
  } catch (error) {
    throw new TurnkeyReactNativeError("Could not delete the session.", error);
  }
};

/**
 * Retrieves the selected session key from secure storage.
 *
 * @returns The selected session key as a string, or `null` if not found.
 * @throws If retrieving the session key fails.
 */
export const getSelectedSessionKey = async (): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: StorageKeys.SelectedSession,
    });
    return credentials ? credentials.password : null;
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to get selected session key",
      error,
    );
  }
};

/**
 * Saves the selected session key to secure storage.
 *
 * @param sessionKey The session key to mark as selected.
 * @throws If saving the session key fails.
 */
export const saveSelectedSessionKey = async (
  sessionKey: string,
): Promise<void> => {
  try {
    await Keychain.setGenericPassword(StorageKeys.SelectedSession, sessionKey, {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: StorageKeys.SelectedSession,
    });
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to save selected session key",
      error,
    );
  }
};

/**
 * Clears the selected session key from secure storage.
 *
 * @throws If deleting the session key fails.
 */
export const clearSelectedSessionKey = async (): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({
      service: StorageKeys.SelectedSession,
    });
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to clear selected session key",
      error,
    );
  }
};

/**
 * Adds a session key to the session list in secure storage.
 *
 * - Retrieves the existing session list.
 * - Appends the new session key if it does not already exist.
 * - Stores the updated session list.
 *
 * @param sessionKey The session key to add.
 * @throws If the session key already exists or saving fails.
 */
export const addSessionKey = async (sessionKey: string): Promise<void> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: StorageKeys.SessionKeys,
    });

    let keys: string[] = [];

    if (credentials) {
      try {
        keys = JSON.parse(credentials.password);
        if (!Array.isArray(keys)) {
          throw new Error("Session list is corrupted.");
        }
      } catch {
        throw new TurnkeyReactNativeError("Failed to parse session list.");
      }
    }

    if (keys.includes(sessionKey)) {
      return;
    }

    keys.push(sessionKey);
    await Keychain.setGenericPassword(
      StorageKeys.SessionKeys,
      JSON.stringify(keys),
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: StorageKeys.SessionKeys,
      },
    );
  } catch (error) {
    throw new TurnkeyReactNativeError("Failed to add session key.", error);
  }
};

/**
 * Retrieves all session keys stored in secure storage.
 *
 * @returns An array of session keys.
 * @throws If retrieving the session list fails.
 */
export const getSessionKeys = async (): Promise<string[]> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: StorageKeys.SessionKeys,
    });

    if (!credentials) {
      return [];
    }

    try {
      const keys = JSON.parse(credentials.password);
      if (!Array.isArray(keys)) {
        throw new Error("Session list is corrupted.");
      }
      return keys;
    } catch {
      throw new TurnkeyReactNativeError("Failed to parse session list.");
    }
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to retrieve session list.",
      error,
    );
  }
};

/**
 * Removes a session key from the session list in secure storage.
 *
 * - Fetches the existing session list.
 * - Removes the specified session key.
 * - Saves the updated session list back to secure storage.
 *
 * @param sessionKey The session key to remove.
 * @throws If removing the session key fails.
 */
export const removeSessionKey = async (sessionKey: string): Promise<void> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: StorageKeys.SessionKeys,
    });

    let keys: string[] = [];

    if (credentials) {
      try {
        keys = JSON.parse(credentials.password);
        if (!Array.isArray(keys)) {
          throw new Error("Session list is corrupted.");
        }
      } catch {
        throw new TurnkeyReactNativeError("Failed to parse session list.");
      }
    }

    const updatedKeys = keys.filter((key) => key !== sessionKey);

    await Keychain.setGenericPassword(
      StorageKeys.SessionKeys,
      JSON.stringify(updatedKeys),
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: StorageKeys.SessionKeys,
      },
    );
  } catch (error) {
    throw new TurnkeyReactNativeError("Failed to remove session key.", error);
  }
};
