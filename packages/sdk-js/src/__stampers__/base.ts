import { getPubKeyFromToken, isReactNative, isWeb } from "@utils";
import { IndexedDbStamper } from "./web/stamper";
import { StorageBase } from "../__storage__/base";

export interface StamperBase {
  listKeyPairs(): Promise<string[]>;
  createKeyPair(externalKeyPair?: CryptoKeyPair): Promise<string>;
  deleteKeyPair(publicKeyHex: string): Promise<void>;
  sign(payload: string, publicKeyHex: string): Promise<string>;
  stamp(
    payload: string,
    publicKeyHex: string
  ): Promise<{ stampHeaderName: string; stampHeaderValue: string }>;
}

export class CrossPlatformApiKeyStamper {
  private stamper!: StamperBase;

  constructor(private storageManager: StorageBase) {
    if (isWeb()) {
      this.stamper = new IndexedDbStamper();
    } else if (isReactNative()) {
      //this.stamper = new ReactNativeKeychainStamper();
    } else {
      throw new Error("Unsupported platform for API key stamper");
    }
  }

  listKeyPairs(): Promise<string[]> {
    return this.stamper.listKeyPairs();
  }

  createKeyPair(externalKeyPair?: CryptoKeyPair): Promise<string> {
    return this.stamper.createKeyPair(externalKeyPair);
  }

  deleteKeyPair(publicKeyHex: string): Promise<void> {
    return this.stamper.deleteKeyPair(publicKeyHex);
  }

  async sign(payload: string): Promise<string> {
    const session = await this.storageManager.getActiveSession();
    console.log("Active session:", session);
    console.log("Session token:", session?.token);
    if (!session?.token) {
      throw new Error("No active session or token available.");
    }
    const publicKey = getPubKeyFromToken(session.token);
    return this.stamper.sign(payload, publicKey);
  }

  async stamp(
    payload: string
  ): Promise<{ stampHeaderName: string; stampHeaderValue: string }> {
    const session = await this.storageManager.getActiveSession();
    console.log("Active session:", session);
    console.log("Session token:", session?.token);
    if (!session?.token) {
      throw new Error("No active session or token available.");
    }
    const publicKey = getPubKeyFromToken(session.token);
    return this.stamper.stamp(payload, publicKey);
  }
}
