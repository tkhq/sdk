import type { Session } from "@turnkey/sdk-types";
import WindowWrapper from "@polyfills/window";
import { StorageBase, SessionKey } from "../base";

const browserStorage = WindowWrapper.localStorage;

export class WebStorageManager implements StorageBase {
  private static SESSION_KEYS_KEY = "sessionKeys";
  private static ACTIVE_SESSION_KEY = "activeSessionKey";

  getStorageValue = async (sessionKey: string): Promise<any> => {
    const item = browserStorage.getItem(sessionKey);
    return item ? JSON.parse(item) : undefined;
  };

  setStorageValue = async (
    sessionKey: string,
    storageValue: any
  ): Promise<void> => {
    browserStorage.setItem(sessionKey, JSON.stringify(storageValue));
  };

  removeStorageValue = async (sessionKey: string): Promise<void> => {
    browserStorage.removeItem(sessionKey);
  };

  storeSession = async (
    session: Session,
    sessionKey: string = SessionKey.DefaultSessionkey
  ): Promise<void> => {
    await this.setStorageValue(sessionKey, session);

    // Ensure the session key is stored in the session keys list
    const keys: string[] =
      (await this.getStorageValue(WebStorageManager.SESSION_KEYS_KEY)) ?? [];
    if (!keys.includes(sessionKey)) {
      keys.push(sessionKey);
      await this.setStorageValue(WebStorageManager.SESSION_KEYS_KEY, keys);
    }

    // Set the active session key
    await this.setStorageValue(
      WebStorageManager.ACTIVE_SESSION_KEY,
      sessionKey
    );
  };

  getSession = async (
    sessionKey: string = SessionKey.DefaultSessionkey
  ): Promise<Session | undefined> => {
    return this.getStorageValue(sessionKey);
  };

  getActiveSessionKey = async (): Promise<string | undefined> => {
    return this.getStorageValue(WebStorageManager.ACTIVE_SESSION_KEY);
  };

  getActiveSession = async (): Promise<Session | undefined> => {
    const key = await this.getActiveSessionKey();
    return key ? this.getSession(key) : undefined;
  };

  listSessionKeys = async (): Promise<string[]> => {
    return (
      (await this.getStorageValue(WebStorageManager.SESSION_KEYS_KEY)) ?? []
    );
  };

  clearSession = async (sessionKey: string): Promise<void> => {
    await this.removeStorageValue(sessionKey);
    const keys = await this.listSessionKeys();
    const updated = keys.filter((k) => k !== sessionKey);
    await this.setStorageValue(WebStorageManager.SESSION_KEYS_KEY, updated);
    const active = await this.getActiveSessionKey();
    if (active === sessionKey) {
      await this.removeStorageValue(WebStorageManager.ACTIVE_SESSION_KEY);
    }
  };

  clearAllSessions = async (): Promise<void> => {
    const keys = await this.listSessionKeys();
    await Promise.all(keys.map((k) => this.removeStorageValue(k)));
    await this.removeStorageValue(WebStorageManager.SESSION_KEYS_KEY);
    await this.removeStorageValue(WebStorageManager.ACTIVE_SESSION_KEY);
  };
}
