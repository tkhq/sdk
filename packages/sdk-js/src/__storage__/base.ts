import { Session } from "@turnkey/sdk-types";
import { WebStorageManager } from "./web/storage";
import { isReactNative, isWeb } from "@utils";

export enum SessionKey {
  DefaultSessionkey = "@turnkey/session/v3",
}

export interface StorageBase {
  // These functions take in strings for sessions. This is just the JWT that is returned from Turnkey.
  getStorageValue(sessionKey: string): Promise<any>;

  setStorageValue(sessionKey: string, storageValue: any): Promise<void>;

  removeStorageValue(sessionKey: string): Promise<void>;

  storeSession(session: string, sessionKey?: string): Promise<void>;

  getSession(sessionKey?: string): Promise<Session | undefined>;

  getActiveSessionKey(): Promise<string | undefined>;

  getActiveSession(): Promise<Session | undefined>;

  listSessionKeys(): Promise<string[]>;

  clearSession(sessionKey: string): Promise<void>;

  clearAllSessions(): Promise<void>;
}
// TODO (Amir): Turn this into a class that extends StorageBase and make an init function. See stamper
export async function createStorageManager(): Promise<StorageBase> {
  if (isReactNative()) {
    try {
      // Dynamic import to prevent bundling the native module in web environments
      const { MobileStorageManager } = await import("./mobile/storage");
      return new MobileStorageManager();
    } catch (error) {
      throw new Error(
        `Failed to load storage manager for react-native: ${error}`,
      );
    }
  } else if (isWeb()) {
    return new WebStorageManager();
  } else {
    throw new Error("Unsupported environment for storage manager.");
  }
}
