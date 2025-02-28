import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  TURNKEY_SELECTED_SESSION,
  TURNKEY_SESSION_KEYS_INDEX,
} from "../constant";
import { TurnkeyReactNativeError } from "../errors";

export const getSelectedSessionKey = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TURNKEY_SELECTED_SESSION);
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
    await AsyncStorage.setItem(TURNKEY_SELECTED_SESSION, sessionKey);
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to save selected session key",
      error,
    );
  }
};

export const clearSelectedSessionKey = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(TURNKEY_SELECTED_SESSION);
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
    const indexStr = await AsyncStorage.getItem(TURNKEY_SESSION_KEYS_INDEX);
    let keys: string[] = indexStr ? JSON.parse(indexStr) : [];
    if (!keys.includes(sessionKey)) {
      keys.push(sessionKey);
      await AsyncStorage.setItem(
        TURNKEY_SESSION_KEYS_INDEX,
        JSON.stringify(keys),
      );
    }
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to add session key to index",
      error,
    );
  }
};

export const getSessionKeysIndex = async (): Promise<string[]> => {
  try {
    const indexStr = await AsyncStorage.getItem(TURNKEY_SESSION_KEYS_INDEX);
    return indexStr ? JSON.parse(indexStr) : [];
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
    const indexStr = await AsyncStorage.getItem(TURNKEY_SESSION_KEYS_INDEX);
    let keys: string[] = indexStr ? JSON.parse(indexStr) : [];
    keys = keys.filter((key) => key !== sessionKey);
    await AsyncStorage.setItem(
      TURNKEY_SESSION_KEYS_INDEX,
      JSON.stringify(keys),
    );
  } catch (error) {
    throw new TurnkeyReactNativeError(
      "Failed to remove session key from index",
      error,
    );
  }
};
