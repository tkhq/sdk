import { Session } from "@turnkey/sdk-types";
import { WebStorageManager } from "./web/storage";
import { isReactNative, isWeb } from "@utils";

export enum SessionKey {
  DefaultSessionkey = "@turnkey/session/v3",
}

export interface StorageBase {
  getStorageValue(sessionKey: string): Promise<any>;

  setStorageValue(sessionKey: string, storageValue: any): Promise<void>;

  removeStorageValue(sessionKey: string): Promise<void>;

  storeSession(session: Session, sessionKey?: string): Promise<void>;

  getSession(sessionKey?: string): Promise<Session | undefined>;

  getActiveSessionKey(): Promise<string | undefined>;

  getActiveSession(): Promise<Session | undefined>;

  listSessionKeys(): Promise<string[]>;

  clearSession(sessionKey: string): Promise<void>;

  clearAllSessions(): Promise<void>;
}

export async function createStorageManager(): Promise<StorageBase> {
  if (isReactNative()) {
    throw new Error("Not implemented for React Native yet.");
    // try {
    //   // Dynamic import to prevent bundling the native module in web environments
    //   const { MobileStorageManager } = await import("./mobile/storage");
    //   return new MobileStorageManager();
    // } catch (error) {
    //   throw new Error(
    //     `Failed to load native secure storage, falling back to memory storage: ${error}`
    //   );
    // }
  } else if (isWeb()) {
    return new WebStorageManager();
  } else {
    throw new Error("Unsupported environment for storage manager.");
  }
}
