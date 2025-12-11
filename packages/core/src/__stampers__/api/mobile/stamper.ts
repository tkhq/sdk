import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { generateP256KeyPair } from "@turnkey/crypto";
import { TStamp, ApiKeyStamperBase, SignatureFormat } from "../../../__types__";

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

  async sign(
    payload: string,
    publicKeyHex: string,
    format?: SignatureFormat,
  ): Promise<string> {
    const privateKey = await this.getPrivateKey(publicKeyHex);
    if (!privateKey) {
      throw new Error(`No private key found for public key: ${publicKeyHex}`);
    }
    const stamper = new ApiKeyStamper({
      apiPublicKey: publicKeyHex,
      apiPrivateKey: privateKey,
    });

    switch (format) {
      case SignatureFormat.Raw: {
        const derSignature = await stamper.sign(payload);
        // Convert DER to raw format
        const derBytes = Uint8Array.from(Buffer.from(derSignature, "hex"));

        // Basic sanity checks for DER structure (expects: 0x30, seqLen, 0x02, rLen, r, 0x02, sLen, s)
        if (derBytes.length < 8 || derBytes[0] !== 0x30) {
          throw new Error("Invalid DER signature format");
        }

        const rLength = derBytes[3];
        if (typeof rLength !== "number") {
          throw new Error("Invalid DER signature: missing r length");
        }

        const rStart = 4;
        const sLengthIndex = 5 + rLength;
        if (sLengthIndex >= derBytes.length) {
          throw new Error("Invalid DER signature: missing s length index");
        }

        const sLength = derBytes[sLengthIndex];
        if (typeof sLength !== "number") {
          throw new Error("Invalid DER signature: missing s length");
        }

        const sStart = sLengthIndex + 1;

        if (
          rStart + rLength > derBytes.length ||
          sStart + sLength > derBytes.length
        ) {
          throw new Error("Invalid DER signature: r/s lengths out of bounds");
        }

        const r = derBytes.slice(rStart, rStart + rLength);
        const s = derBytes.slice(sStart, sStart + sLength);
        const rawSignature = new Uint8Array(64);
        rawSignature.set(r, 32 - r.length);
        rawSignature.set(s, 64 - s.length);
        return Buffer.from(rawSignature).toString("hex");
      }
      case SignatureFormat.Der:
      default:
        return stamper.sign(payload);
    }
  }
}
