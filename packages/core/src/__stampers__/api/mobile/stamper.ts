import { ApiKeyStamper, SignatureFormat } from "@turnkey/api-key-stamper";
import { generateP256KeyPair } from "@turnkey/crypto";
import type { TStamp, ApiKeyStamperBase } from "../../../__types__";

let Keychain: typeof import("react-native-keychain");

try {
  Keychain = require("react-native-keychain");
} catch {
  throw new Error(
    "Please install react-native-keychain in your app to use ReactNativeKeychainStamper",
  );
}

// In versions <=1.8.0, keys were stored using just the publicKey as the keychain service name
// This caused `listKeyPairs()` to return ALL keychain entries (including non-Turnkey ones),
// which meant `clearUnusedKeyPairs()` would delete the user's own keychain data
//
// To fix this, we now prefix all Turnkey-managed keys with this constant to scope them
// properly to Turnkey. Methods that read or delete keys still fall back to the unprefixed
// service name to migrate legacy keys. This fallback can be removed once we're confident
// all users have  migrated to the prefixed format
const TURNKEY_KEY_PREFIX = "com.turnkey.keypair:";

export class ReactNativeKeychainStamper implements ApiKeyStamperBase {
  private serviceName(publicKeyHex: string): string {
    return `${TURNKEY_KEY_PREFIX}${publicKeyHex}`;
  }

  async listKeyPairs(): Promise<string[]> {
    const allServices = await Keychain.getAllGenericPasswordServices();
    return allServices
      .filter((service: string) => service.startsWith(TURNKEY_KEY_PREFIX))
      .map((service: string) => service.slice(TURNKEY_KEY_PREFIX.length));
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

    // we store in Keychain with a
    // Turnkey-specific service prefix
    await Keychain.setGenericPassword(publicKey, privateKey, {
      service: this.serviceName(publicKey),
    });

    return publicKey;
  }

  async deleteKeyPair(publicKeyHex: string): Promise<void> {
    // we check if the key exists under the prefixed service name
    // - if it exists, we delete that
    // - otherwise, we assume it's a legacy (unprefixed) key and try to delete that
    const hasPrefixed = await Keychain.getGenericPassword({
      service: this.serviceName(publicKeyHex),
    });
    await Keychain.resetGenericPassword({
      service: hasPrefixed ? this.serviceName(publicKeyHex) : publicKeyHex,
    });
  }

  private async getPrivateKey(publicKeyHex: string): Promise<string | null> {
    // we check if the key exists under the prefixed service name
    // - if it exists, we return the private key
    // - otherwise, we assume it's a legacy (unprefixed) key, migrate it
    //   to the prefixed format, and return the private key
    const prefixedCreds = await Keychain.getGenericPassword({
      service: this.serviceName(publicKeyHex),
    });
    if (prefixedCreds) return prefixedCreds.password;

    // we fall back to the unprefixed (legacy) service name
    const creds = await Keychain.getGenericPassword({
      service: publicKeyHex,
    });
    if (!creds) return null;

    // migrate the legacy key to the prefixed format so it's properly scoped going forward
    await Keychain.setGenericPassword(creds.username, creds.password, {
      service: this.serviceName(publicKeyHex),
    });
    await Keychain.resetGenericPassword({ service: publicKeyHex });

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
    format: SignatureFormat,
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
        return stamper.sign(payload, SignatureFormat.Raw);
      }
      case SignatureFormat.Der:
        return stamper.sign(payload, SignatureFormat.Der);
      default:
        throw new Error(`Unsupported signature format: ${format}`);
    }
  }
}
