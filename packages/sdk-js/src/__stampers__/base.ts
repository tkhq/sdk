import { isReactNative, isWeb } from "@utils";
import { IndexedDbStamper } from "./web/stamper";
import { StorageBase } from "../__storage__/base";

export interface StamperBase {
  listKeyPairs(): Promise<string[]>;
  createKeyPair(
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string },
  ): Promise<string>;
  deleteKeyPair(publicKeyHex: string): Promise<void>;
  clearKeyPairs(): Promise<void>;
  stamp(
    payload: string,
    publicKeyHex: string,
  ): Promise<{ stampHeaderName: string; stampHeaderValue: string }>;
}

export class CrossPlatformApiKeyStamper {
  private stamper!: StamperBase;

  constructor(private storageManager: StorageBase) {
    // Use init method to set up the stamper based on the platform. It's async, so can't be done in the constructor.
  }

  async init(): Promise<void> {
    if (isWeb()) {
      this.stamper = new IndexedDbStamper();
    } else if (isReactNative()) {
      try {
        // Dynamic import to prevent bundling the native module in web environments.
        const { ReactNativeKeychainStamper } = await import("./mobile/stamper");
        this.stamper = new ReactNativeKeychainStamper();
      } catch (error) {
        throw new Error(
          `Failed to load storage manager for react-native: ${error}`,
        );
      }
    } else {
      throw new Error("Unsupported platform for API key stamper");
    }
  }

  listKeyPairs(): Promise<string[]> {
    // TODO (Amir): Wait, this doesn't show the private key, right? 0_0
    return this.stamper.listKeyPairs();
  }

  createKeyPair(
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string },
  ): Promise<string> {
    return this.stamper.createKeyPair(externalKeyPair);
  }

  deleteKeyPair(publicKeyHex: string): Promise<void> {
    return this.stamper.deleteKeyPair(publicKeyHex);
  }

  clearKeyPairs?(): Promise<void> {
    return this.stamper.clearKeyPairs();
  }

  async stamp(
    payload: string,
  ): Promise<{ stampHeaderName: string; stampHeaderValue: string }> {
    const session = await this.storageManager.getActiveSession();
    console.log("Active session:", session);
    console.log("Session token:", session?.token);
    if (!session) {
      throw new Error("No active session or token available.");
    }
    return this.stamper.stamp(payload, session.token);
  }
}
