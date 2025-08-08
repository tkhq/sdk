import { WebStorageManager } from "./web/storage";
import { isReactNative, isWeb } from "@utils";
import type { StorageBase } from "@types";

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
