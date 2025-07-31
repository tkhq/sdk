import { WebStorageManager } from "./web/storage";
import type { StorageBase } from "@types";

// TODO (Amir): Turn this into a class that extends StorageBase and make an init function. See stamper
export async function createStorageManager(): Promise<StorageBase> {
    return new WebStorageManager();
}
