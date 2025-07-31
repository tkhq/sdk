import { WebStorageManager } from "./web/storage";
import { MobileStorageManager } from "./mobile/storage";
import { isMobile, isWeb } from "@utils";
import type { StorageBase } from "@types";

// TODO (Amir): Turn this into a class that extends StorageBase and make an init function. See stamper
export async function createStorageManager(): Promise<StorageBase> {
  if (isMobile()) {
    return new MobileStorageManager();
  } else if (isWeb()) {
    return new WebStorageManager();
  } else {
    throw new Error("Unsupported environment for storage manager.");
  }
}
