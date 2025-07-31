import { IndexedDbStamper } from "./web/stamper";
import type { TStamp, TStamper, StorageBase, ApiKeyStamperBase } from "@types";

export class CrossPlatformApiKeyStamper implements TStamper {
  private stamper!: ApiKeyStamperBase;
  private publicKeyOverride?: string | undefined;
  constructor(private storageManager: StorageBase) {
    // Use init method to set up the stamper based on the platform. It's async, so can't be done in the constructor.
  }

  async init(): Promise<void> {
    this.stamper = new IndexedDbStamper();
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

  // TODO (Amir): This function needs to be explained well
  setPublicKeyOverride(publicKeyHex: string | undefined): void {
    this.publicKeyOverride = publicKeyHex;
  }

  getPublicKeyOverride(): string | undefined {
    return this.publicKeyOverride;
  }

  clearOverridePublicKey(): void {
    this.publicKeyOverride = undefined;
  }

  async stamp(payload: string): Promise<TStamp> {
    let publicKeyHex = this.publicKeyOverride;
    if (!publicKeyHex) {
      const session = await this.storageManager.getActiveSession();
      if (!session) {
        throw new Error("No active session or token available.");
      }
      publicKeyHex = session.publicKey!;
    }

    return this.stamper.stamp(payload, publicKeyHex);
  }
}
