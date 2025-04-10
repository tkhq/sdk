import { uint8ArrayToHexString, stringToBase64urlString } from "@turnkey/encoding";

const DB_NAME = "TurnkeyStamperDB";
const DB_STORE = "KeyStore";
const DB_KEY = "turnkeyKeyPair";
// Header name for an API key stamp
const stampHeaderName = "X-Stamp";

export class IndexedDbStamper {
  private publicKeyHex: string | null = null;
  private privateKey: CryptoKey | null = null;

  constructor() {
    if (typeof window === "undefined") {
      throw new Error("IndexedDB is only available in the browser");
    }
  }

  private async openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        request.result.createObjectStore(DB_STORE);
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async storeKeyPair(publicKey: string, privateKey: CryptoKey): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(DB_STORE, "readwrite");
    const store = tx.objectStore(DB_STORE);

    store.put(publicKey, `${DB_KEY}-pub`);
    store.put(privateKey, `${DB_KEY}-priv`);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  private async getStoredKeys(): Promise<{
    publicKey: string | null;
    privateKey: CryptoKey | null;
  }> {
    const db = await this.openDb();
    const tx = db.transaction(DB_STORE, "readonly");
    const store = tx.objectStore(DB_STORE);

    return new Promise((resolve) => {
      const getPub = store.get(`${DB_KEY}-pub`);
      const getPriv = store.get(`${DB_KEY}-priv`);

      getPriv.onsuccess = () => {
        getPub.onsuccess = () => {
          resolve({
            publicKey: getPub.result || null,
            privateKey: getPriv.result || null,
          });
        };
      };
    });
  }

  async init(): Promise<void> {
    const { publicKey, privateKey } = await this.getStoredKeys();

    if (publicKey && privateKey) {
      this.publicKeyHex = publicKey;
      this.privateKey = privateKey;
    } else {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "ECDSA",
          namedCurve: "P-256",
        },
        false, // unextractable
        ["sign", "verify"]
      );

      const rawPubKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
      const pubKeyHex = uint8ArrayToHexString(new Uint8Array(rawPubKey));

      await this.storeKeyPair(pubKeyHex, keyPair.privateKey);

      this.publicKeyHex = pubKeyHex;
      this.privateKey = keyPair.privateKey;
    }
  }

  getPublicKey(): string | null {
    return this.publicKeyHex;
  }

  async sign(payload: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error("Key not initialized. Call init() first.");
    }

    const encodedPayload = new TextEncoder().encode(payload);
    const signature = await crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
      },
      this.privateKey,
      encodedPayload
    );

    return uint8ArrayToHexString(new Uint8Array(signature));
  }

  async stamp(payload: string): Promise<{
    stampHeaderName: string;
    stampHeaderValue: string;
  }> {
    if (!this.publicKeyHex || !this.privateKey) {
      throw new Error("Key not initialized. Call init() first.");
    }

    const signature = await this.sign(payload);

    const stamp = {
      publicKey: this.publicKeyHex,
      scheme: "SIGNATURE_SCHEME_TK_API_P256",
      signature: signature,
    };

    return {
      stampHeaderName: stampHeaderName,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}


