import * as Keychain from "react-native-keychain";
import { TURNKEY_EMBEDDED_KEY_STORAGE } from "../constant";
import { TurnkeyReactNativeError } from "../errors";
import { Session } from "../types";

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
