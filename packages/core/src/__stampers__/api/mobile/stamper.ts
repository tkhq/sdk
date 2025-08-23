import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { generateP256KeyPair } from "@turnkey/crypto";
import type { TStamp, ApiKeyStamperBase } from "@types";

let Keychain: typeof import("react-native-keychain");

try {
  Keychain = require("react-native-keychain");
} catch {
  throw new Error(
    "Please install react-native-keychain in your app to use ReactNativeKeychainStamper",
  );
}

export class ReactNativeKeychainStamper implements ApiKeyStamperBase {
  async listKeyPairs(): Promise<string[]> {
    return await Keychain.getAllGenericPasswordServices();
  }

  async clearKeyPairs(): Promise<void> {
    const keys = await this.listKeyPairs();
    for (const key of keys) {
      await this.deleteKeyPair(key);
    }
  }

  async createKeyPair(externalKeyPair?: {
    publicKey: string;
    privateKey: string;
  }): Promise<string> {
    let privateKey: string;
    let publicKey: string;

    if (externalKeyPair) {
      privateKey = externalKeyPair.privateKey;
      publicKey = externalKeyPair.publicKey;
    } else {
      const pair = generateP256KeyPair();
      privateKey = pair.privateKey;
      publicKey = pair.publicKey;
    }

    // store in Keychain
    await Keychain.setGenericPassword(publicKey, privateKey, {
      service: publicKey,
    });

    return publicKey;
  }

  async deleteKeyPair(publicKeyHex: string): Promise<void> {
    await Keychain.resetGenericPassword({
      service: publicKeyHex,
    });
  }

  private async getPrivateKey(publicKeyHex: string): Promise<string | null> {
    const creds = await Keychain.getGenericPassword({
      service: publicKeyHex,
    });
    if (!creds) return null;

    return creds.password;
  }

  async stamp(payload: string, publicKeyHex: string): Promise<TStamp> {
    const privateKey = await this.getPrivateKey(publicKeyHex);
    if (!privateKey) {
      throw new Error(`No private key found for public key: ${publicKeyHex}`);
    }
    const stamper = new ApiKeyStamper({
      apiPublicKey: publicKeyHex,
      apiPrivateKey: privateKey,
    });
    const { stampHeaderName, stampHeaderValue } = await stamper.stamp(payload);
    return { stampHeaderName, stampHeaderValue };
  }
}
