import * as Keychain from "react-native-keychain";
import {
  TURNKEY_EMBEDDED_KEY_STORAGE,
  TURNKEY_SELECTED_SESSION,
  TURNKEY_SESSION_KEYS_INDEX,
} from "./constants";
import { TurnkeyReactNativeError } from "./errors";
import type { Session } from "./types";

/**
 * Retrieves the stored embedded key from secure storage.
 * Optionally deletes the key from storage after retrieval.
 *
 * @param deleteKey Whether to remove the embedded key after retrieval. Defaults to `true`.
 * @returns The embedded private key if found, otherwise `null`.
 * @throws If retrieving or deleting the key fails.
 */
export const getEmbeddedKey = async (
  deleteKey = true,
): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_EMBEDDED_KEY_STORAGE,
    });

    if (credentials) {
      if (deleteKey) {
        await Keychain.resetGenericPassword({
          service: TURNKEY_EMBEDDED_KEY_STORAGE,
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
 * Saves an embedded key securely in storage.
 *
 * @param key The private key to store securely.
 * @throws If saving the key fails.
 */
export const saveEmbeddedKey = async (key: string): Promise<void> => {
  try {
    await Keychain.setGenericPassword(TURNKEY_EMBEDDED_KEY_STORAGE, key, {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: TURNKEY_EMBEDDED_KEY_STORAGE,
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
export const getSession = async (sessionKey: string): Promise<any | null> => {
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
      service: TURNKEY_SELECTED_SESSION,
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
    await Keychain.setGenericPassword(TURNKEY_SELECTED_SESSION, sessionKey, {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: TURNKEY_SELECTED_SESSION,
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
    await Keychain.resetGenericPassword({ service: TURNKEY_SELECTED_SESSION });
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to clear selected session key",
      error,
    );
  }
};

/**
 * Adds a session key to the session index in secure storage.
 *
 * - Retrieves the existing session key index.
 * - Appends the new session key if it does not already exist.
 * - Stores the updated session index.
 *
 * @param sessionKey The session key to add to the index.
 * @throws If the session key already exists or saving the index fails.
 */
export const addSessionKeyToIndex = async (
  sessionKey: string,
): Promise<void> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_SESSION_KEYS_INDEX,
    });

    let keys: string[] = credentials ? JSON.parse(credentials.password) : [];

    // we throw an error if the sessionKey already exists
    if (keys.includes(sessionKey)) {
      throw new TurnkeyReactNativeError(
        `Session key "${sessionKey}" already exists in the index.`,
      );
    }

    keys.push(sessionKey);
    await Keychain.setGenericPassword(
      TURNKEY_SESSION_KEYS_INDEX,
      JSON.stringify(keys),
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: TURNKEY_SESSION_KEYS_INDEX,
      },
    );
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to add session key to index",
      error,
    );
  }
};

/**
 * Retrieves all session keys stored in the session index.
 *
 * @returns An array of session keys stored in secure storage.
 * @throws If retrieving the session index fails.
 */
export const getSessionKeyIndex = async (): Promise<string[]> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_SESSION_KEYS_INDEX,
    });

    return credentials ? JSON.parse(credentials.password) : [];
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to get session keys index",
      error,
    );
  }
};

/**
 * Removes a session key from the session index in secure storage.
 *
 * - Fetches the existing session key index.
 * - Removes the specified session key.
 * - Saves the updated session index back to secure storage.
 *
 * @param sessionKey The session key to remove from the index.
 * @throws If removing the session key fails.
 */
export const removeSessionKeyFromIndex = async (
  sessionKey: string,
): Promise<void> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_SESSION_KEYS_INDEX,
    });
    let keys: string[] = credentials ? JSON.parse(credentials.password) : [];

    keys = keys.filter((key) => key !== sessionKey);

    await Keychain.setGenericPassword(
      TURNKEY_SESSION_KEYS_INDEX,
      JSON.stringify(keys),
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: TURNKEY_SESSION_KEYS_INDEX,
      },
    );
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to remove session key from index",
      error,
    );
  }
};
