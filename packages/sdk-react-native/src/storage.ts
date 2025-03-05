import * as Keychain from "react-native-keychain";
import {
  TURNKEY_EMBEDDED_KEY_STORAGE,
  TURNKEY_SELECTED_SESSION,
  TURNKEY_SESSION_IDS_INDEX,
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
 * @param sessionId The unique id identifying the session.
 * @returns The session object if found, otherwise `null`.
 * @throws If retrieving the session fails.
 */
export const getSession = async (sessionId: string): Promise<any | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: sessionId,
    });

    return credentials ? JSON.parse(credentials.password) : null;
  } catch (error) {
    throw new TurnkeyReactNativeError(
      `Failed to get session for sessionId "${sessionId}"`,
      error,
    );
  }
};

/**
 * Saves a session securely in storage.
 *
 * @param session The session object to store securely.
 * @param sessionId The unique id under which the session is stored.
 * @throws If saving the session fails.
 */
export const saveSession = async (
  session: Session,
  sessionId: string,
): Promise<void> => {
  try {
    await Keychain.setGenericPassword(sessionId, JSON.stringify(session), {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: sessionId,
    });
  } catch (error) {
    throw new TurnkeyReactNativeError("Could not save the session", error);
  }
};

/**
 * Deletes a session from secure storage.
 *
 * @param sessionId The unique id identifying the session to reset.
 * @throws If deleting the session fails.
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({ service: sessionId });
  } catch (error) {
    throw new TurnkeyReactNativeError("Could not delete the session.", error);
  }
};

/**
 * Retrieves the selected session id from secure storage.
 *
 * @returns The selected session id as a string, or `null` if not found.
 * @throws If retrieving the session id fails.
 */
export const getSelectedSessionId = async (): Promise<string | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_SELECTED_SESSION,
    });
    return credentials ? credentials.password : null;
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to get selected session id",
      error,
    );
  }
};

/**
 * Saves the selected session id to secure storage.
 *
 * @param sessionId The session id to mark as selected.
 * @throws If saving the session id fails.
 */
export const saveSelectedSessionId = async (
  sessionId: string,
): Promise<void> => {
  try {
    await Keychain.setGenericPassword(TURNKEY_SELECTED_SESSION, sessionId, {
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      service: TURNKEY_SELECTED_SESSION,
    });
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to save selected session id",
      error,
    );
  }
};

/**
 * Clears the selected session id from secure storage.
 *
 * @throws If deleting the session id fails.
 */
export const clearSelectedSessionId = async (): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({ service: TURNKEY_SELECTED_SESSION });
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to clear selected session id",
      error,
    );
  }
};

/**
 * Adds a session id to the session index in secure storage.
 *
 * - Retrieves the existing session id index.
 * - Appends the new session id if it does not already exist.
 * - Stores the updated session index.
 *
 * @param sessionId The session id to add to the index.
 * @throws If the session id already exists or saving the index fails.
 */
export const addSessionIdToIndex = async (
  sessionId: string,
): Promise<void> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_SESSION_IDS_INDEX,
    });

    let ids: string[] = credentials ? JSON.parse(credentials.password) : [];

    // we throw an error if the sessionId already exists
    if (ids.includes(sessionId)) {
      throw new TurnkeyReactNativeError(
        `Session id "${sessionId}" already exists in the index.`,
      );
    }

    ids.push(sessionId);
    await Keychain.setGenericPassword(
      TURNKEY_SESSION_IDS_INDEX,
      JSON.stringify(ids),
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: TURNKEY_SESSION_IDS_INDEX,
      },
    );
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to add session id to index",
      error,
    );
  }
};

/**
 * Retrieves all session ids stored in the session index.
 *
 * @returns An array of session ids stored in secure storage.
 * @throws If retrieving the session index fails.
 */
export const getSessionIdIndex = async (): Promise<string[]> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_SESSION_IDS_INDEX,
    });

    return credentials ? JSON.parse(credentials.password) : [];
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to get session ids index",
      error,
    );
  }
};

/**
 * Removes a session id from the session index in secure storage.
 *
 * - Fetches the existing session id index.
 * - Removes the specified session id.
 * - Saves the updated session index back to secure storage.
 *
 * @param sessionId The session id to remove from the index.
 * @throws If removing the session id fails.
 */
export const removeSessionIdFromIndex = async (
  sessionId: string,
): Promise<void> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: TURNKEY_SESSION_IDS_INDEX,
    });
    let ids: string[] = credentials ? JSON.parse(credentials.password) : [];

    ids = ids.filter((id) => id !== sessionId);

    await Keychain.setGenericPassword(
      TURNKEY_SESSION_IDS_INDEX,
      JSON.stringify(ids),
      {
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        service: TURNKEY_SESSION_IDS_INDEX,
      },
    );
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to remove session id from index",
      error,
    );
  }
};
