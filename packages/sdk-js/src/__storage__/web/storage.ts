import WindowWrapper from "@polyfills/window";
import { StorageBase, SessionKey } from "../base";
import { parseSession } from "@utils";
import { Session } from "@turnkey/sdk-types";
import { Wallet } from "@types";

const browserStorage = WindowWrapper.localStorage;

export class WebStorageManager implements StorageBase {
  private static ALL_SESSION_KEYS = "@turnkey/all-session-keys";
  private static ACTIVE_SESSION_KEY = "@turnkey/active-session-key";

  getStorageValue = async (sessionKey: string): Promise<any> => {
    const item = browserStorage.getItem(sessionKey);
    return item ? JSON.parse(item) : undefined;
  };

  setStorageValue = async (
    sessionKey: string,
    storageValue: any,
  ): Promise<void> => {
    browserStorage.setItem(sessionKey, JSON.stringify(storageValue));
  };

  setActiveSessionKey = async (sessionKey: string): Promise<void> => {
    await this.setStorageValue(
      WebStorageManager.ACTIVE_SESSION_KEY,
      sessionKey,
    );
  };

  removeStorageValue = async (sessionKey: string): Promise<void> => {
    browserStorage.removeItem(sessionKey);
  };

  storeSession = async (
    session: string,
    sessionKey: string = SessionKey.DefaultSessionkey,
  ): Promise<void> => {
    const sessionWithMetadata = parseSession(session);

    await this.setStorageValue(sessionKey, sessionWithMetadata);

    // Ensure the session key is stored in the session keys list
    const keys: string[] =
      (await this.getStorageValue(WebStorageManager.ALL_SESSION_KEYS)) ?? [];
    if (!keys.includes(sessionKey)) {
      keys.push(sessionKey);
      await this.setStorageValue(WebStorageManager.ALL_SESSION_KEYS, keys);
    }

    // Set the active session key
    await this.setStorageValue(
      WebStorageManager.ACTIVE_SESSION_KEY,
      sessionKey,
    );
  };

  getSession = async (
    sessionKey: string = SessionKey.DefaultSessionkey,
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
      (await this.getStorageValue(WebStorageManager.ALL_SESSION_KEYS)) ?? []
    );
  };

  clearSession = async (sessionKey: string): Promise<void> => {
    await this.removeStorageValue(sessionKey);
    const keys = await this.listSessionKeys();
    const updated = keys.filter((k) => k !== sessionKey);
    await this.setStorageValue(WebStorageManager.ALL_SESSION_KEYS, updated);
    const active = await this.getActiveSessionKey();
    if (active === sessionKey) {
      await this.removeStorageValue(WebStorageManager.ACTIVE_SESSION_KEY);
    }
  };

  clearAllSessions = async (): Promise<void> => {
    const keys = await this.listSessionKeys();
    await Promise.all(keys.map((k) => this.removeStorageValue(k)));
    await this.removeStorageValue(WebStorageManager.ALL_SESSION_KEYS);
    await this.removeStorageValue(WebStorageManager.ACTIVE_SESSION_KEY);
  };

  storeWallets = async (wallets: Wallet[]): Promise<void> => {
    for (const wallet of wallets) {
      browserStorage.setItem(wallet.walletId, JSON.stringify(wallet));
    }
  };
}
