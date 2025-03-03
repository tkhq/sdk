import * as Keychain from "react-native-keychain";
import {
  TURNKEY_EMBEDDED_KEY_STORAGE,
  TURNKEY_SELECTED_SESSION,
  TURNKEY_SESSION_KEYS_INDEX,
} from "./constants";
import { TurnkeyReactNativeError } from "./errors";
import type { Session } from "./types";

export const getEmbeddedKey = async (
  deleteKey = true,
): Promise<string | null> => {
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
};

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

export const getSession = async (sessionKey: string): Promise<any | null> => {
  const credentials = await Keychain.getGenericPassword({
    service: sessionKey,
  });
  return credentials ? JSON.parse(credentials.password) : null;
};

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

export const resetSession = async (sessionKey: string): Promise<void> => {
  try {
    await Keychain.resetGenericPassword({ service: sessionKey });
  } catch (error) {
    throw new TurnkeyReactNativeError("Could not reset the session.", error);
  }
};

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
