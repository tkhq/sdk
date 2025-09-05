import { isReactNative, isWeb } from "@utils";
import { IndexedDbStamper } from "./web/stamper";
import type { TStamp, TStamper, StorageBase, ApiKeyStamperBase } from "@types";
import { TurnkeyError, TurnkeyErrorCodes } from "@turnkey/sdk-types";

/**
 * Cross-platform API key stamper.
 *
 * - This stamper uses indexedDB on web and keychain on react-native to securely stamp Turnkey requests.
 * - ***Only supports P-256 ECDSA key pairs.***
 */
export class CrossPlatformApiKeyStamper implements TStamper {
  private stamper?: ApiKeyStamperBase;
  private temporaryPublicKey?: string | undefined;
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
        throw new TurnkeyError(
          `Failed to load keychain stamper for react-native`,
          TurnkeyErrorCodes.INITIALIZE_CLIENT_ERROR,
          error,
        );
      }
    } else {
      throw new TurnkeyError(
        "Unsupported platform for API key stamper",
        TurnkeyErrorCodes.UNSUPPORTED_PLATFORM,
      );
    }
  }

  listKeyPairs(): Promise<string[]> {
    if (!this.stamper) {
      throw new TurnkeyError(
        "Stamper is not initialized. Please call .init() before calling this method.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    return this.stamper.listKeyPairs();
  }

  createKeyPair(
    externalKeyPair?: CryptoKeyPair | { publicKey: string; privateKey: string },
  ): Promise<string> {
    if (!this.stamper) {
      throw new TurnkeyError(
        "Stamper is not initialized. Please call .init() before calling this method.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    return this.stamper.createKeyPair(externalKeyPair);
  }

  deleteKeyPair(publicKeyHex: string): Promise<void> {
    if (!this.stamper) {
      throw new TurnkeyError(
        "Stamper is not initialized. Please call .init() before calling this method.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    return this.stamper.deleteKeyPair(publicKeyHex);
  }

  clearKeyPairs?(): Promise<void> {
    if (!this.stamper) {
      throw new TurnkeyError(
        "Stamper is not initialized. Please call .init() before calling this method.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    return this.stamper.clearKeyPairs();
  }

  // This allows forcing a specific public key to find the key pair for stamping. The key pair must already exist in indexedDB / Keychain.
  // This is useful if you need to stamp with a specific key pair without having an active session.
  // See "signUpWithPasskey" function in core.ts for usage
  setTemporaryPublicKey(publicKeyHex: string | undefined): void {
    this.temporaryPublicKey = publicKeyHex;
  }

  getTemporaryPublicKey(): string | undefined {
    return this.temporaryPublicKey;
  }

  clearTemporaryPublicKey(): void {
    this.temporaryPublicKey = undefined;
  }

  async stamp(payload: string): Promise<TStamp> {
    if (!this.stamper) {
      throw new TurnkeyError(
        "Stamper is not initialized. Please call .init() before calling this method.",
        TurnkeyErrorCodes.CLIENT_NOT_INITIALIZED,
      );
    }
    let publicKeyHex = this.temporaryPublicKey;
    if (!publicKeyHex) {
      const session = await this.storageManager.getActiveSession();
      if (!session) {
        throw new TurnkeyError(
          "No active session or token available.",
          TurnkeyErrorCodes.NO_SESSION_FOUND,
        );
      }
      publicKeyHex = session.publicKey!;
    }

    return this.stamper.stamp(payload, publicKeyHex);
  }
}
