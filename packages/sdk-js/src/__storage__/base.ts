import { Session } from "@turnkey/sdk-types";
import { AuthClient } from "..";
import { WebStorageManager } from "./web/storage";

export enum StorageKey {
  Session = "@turnkey/session/v2",
  Client = "@turnkey/client",
}
export interface StorageValue {
  [StorageKey.Session]: Session;
  [StorageKey.Client]: AuthClient; // TODO (Amir): I don't think we need this
}

export interface StorageBase {
  getStorageValue<K extends StorageKey>(
    key: K,
  ): Promise<StorageValue[K] | undefined>;
  setStorageValue<K extends StorageKey>(
    storageKey: K,
    storageValue: StorageValue[K],
  ): Promise<any>;
  removeStorageValue<K extends StorageKey>(storageKey: K): Promise<void>;
  storeSession(session: Session): Promise<any>;
}

export const isReactNative = (): boolean => {
  return (
    typeof navigator !== "undefined" && navigator.product === "ReactNative"
  );
};

export const isWeb = (): boolean => {
  return typeof window !== "undefined" && typeof document !== "undefined";
};

export async function createStorageManager(): Promise<StorageBase> {
  if (isReactNative()) {
    try {
      // Dynamic import to prevent bundling the native module in web environments
      const { MobileStorageManager } = await import("./mobile/storage");
      return new MobileStorageManager();
    } catch (error) {
      throw new Error(
        `Failed to load native secure storage, falling back to memory storage: ${error}`,
      );
    }
  } else if (isWeb()) {
    return new WebStorageManager();
  } else {
    throw new Error("Unsupported environment for storage manager.");
  }
}
