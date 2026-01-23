import { type StorageBase, SessionKey } from "../../__types__";
import { parseSession } from "@utils";
import type { Session } from "@turnkey/sdk-types";

let AsyncStorage: (typeof import("@react-native-async-storage/async-storage"))["default"];

try {
  const mod = require("@react-native-async-storage/async-storage");
  AsyncStorage = mod.default ?? mod;
} catch {
  throw new Error(
    "Please install @react-native-async-storage/async-storage in your app to use MobileStorageManager",
  );
}

export class MobileStorageManager implements StorageBase {
  private static ALL_SESSION_KEYS = "@turnkey/all-session-keys";
  private static ACTIVE_SESSION_KEY = "@turnkey/active-session-key";

  getStorageValue = async (sessionKey: string): Promise<any> => {
    const item = await AsyncStorage.getItem(sessionKey);
    return item ? JSON.parse(item) : undefined;
  };

  setStorageValue = async (
    sessionKey: string,
    storageValue: any,
  ): Promise<void> => {
    await AsyncStorage.setItem(sessionKey, JSON.stringify(storageValue));
  };

  setActiveSessionKey = async (sessionKey: string): Promise<void> => {
    await this.setStorageValue(
      MobileStorageManager.ACTIVE_SESSION_KEY,
      sessionKey,
    );
  };

  removeStorageValue = async (sessionKey: string): Promise<void> => {
    await AsyncStorage.removeItem(sessionKey);
  };

  storeSession = async (
    session: string,
    sessionKey: string = SessionKey.DefaultSessionkey,
  ): Promise<void> => {
    const sessionWithMetadata = parseSession(session);
    await this.setStorageValue(sessionKey, sessionWithMetadata);

    const raw = await this.getStorageValue(
      MobileStorageManager.ALL_SESSION_KEYS,
    );
    const keys: string[] = Array.isArray(raw) ? raw : [];
    if (!keys.includes(sessionKey)) {
      keys.push(sessionKey);
      await this.setStorageValue(MobileStorageManager.ALL_SESSION_KEYS, keys);
    }

    await this.setStorageValue(
      MobileStorageManager.ACTIVE_SESSION_KEY,
      sessionKey,
    );
  };

  getSession = async (
    sessionKey: string = SessionKey.DefaultSessionkey,
  ): Promise<Session | undefined> => {
    return this.getStorageValue(sessionKey);
  };

  getActiveSessionKey = async (): Promise<string | undefined> => {
    return this.getStorageValue(MobileStorageManager.ACTIVE_SESSION_KEY);
  };

  getActiveSession = async (): Promise<Session | undefined> => {
    const key = await this.getActiveSessionKey();
    return key ? this.getSession(key) : undefined;
  };

  listSessionKeys = async (): Promise<string[]> => {
    const raw = await this.getStorageValue(
      MobileStorageManager.ALL_SESSION_KEYS,
    );
    return Array.isArray(raw) ? raw : [];
  };

  clearSession = async (sessionKey: string): Promise<void> => {
    await this.removeStorageValue(sessionKey);

    const keys = await this.listSessionKeys();
    const updated = keys.filter((k) => k !== sessionKey);
    await this.setStorageValue(MobileStorageManager.ALL_SESSION_KEYS, updated);

    const active = await this.getActiveSessionKey();
    if (active === sessionKey) {
      await this.removeStorageValue(MobileStorageManager.ACTIVE_SESSION_KEY);
    }
  };

  clearAllSessions = async (): Promise<void> => {
    const keys = await this.listSessionKeys();
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k)));
    await this.removeStorageValue(MobileStorageManager.ALL_SESSION_KEYS);
    await this.removeStorageValue(MobileStorageManager.ACTIVE_SESSION_KEY);
  };
}
