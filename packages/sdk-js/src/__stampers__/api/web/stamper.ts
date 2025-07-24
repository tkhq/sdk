import {
  uint8ArrayToHexString,
  stringToBase64urlString,
  pointEncode,
} from "@turnkey/encoding";
import type { TStamp, ApiKeyStamperBase } from "@types";

const DB_NAME = "TurnkeyStamperDB";
const DB_STORE = "KeyStore";
const stampHeaderName = "X-Stamp";

function convertEcdsaIeee1363ToDer(ieee: Uint8Array): Uint8Array {
  if (ieee.length % 2 != 0 || ieee.length == 0 || ieee.length > 132) {
    throw new Error(
      "Invalid IEEE P1363 signature encoding. Length: " + ieee.length,
    );
  }
  const r = toUnsignedBigNum(ieee.subarray(0, ieee.length / 2));
  const s = toUnsignedBigNum(ieee.subarray(ieee.length / 2, ieee.length));
  let offset = 0;
  const length = 1 + 1 + r.length + 1 + 1 + s.length;
  let der: Uint8Array;
  if (length >= 128) {
    der = new Uint8Array(length + 3);
    der[offset++] = 48;
    der[offset++] = 128 + 1;
    der[offset++] = length;
  } else {
    der = new Uint8Array(length + 2);
    der[offset++] = 48;
    der[offset++] = length;
  }
  der[offset++] = 2;
  der[offset++] = r.length;
  der.set(r, offset);
  offset += r.length;
  der[offset++] = 2;
  der[offset++] = s.length;
  der.set(s, offset);
  return der;
}

function toUnsignedBigNum(bytes: Uint8Array): Uint8Array {
  let start = 0;
  while (start < bytes.length && bytes[start] == 0) {
    start++;
  }
  if (start == bytes.length) {
    start = bytes.length - 1;
  }
  let extraZero = 0;
  if ((bytes[start]! & 128) == 128) {
    extraZero = 1;
  }
  const res = new Uint8Array(bytes.length - start + extraZero);
  res.set(bytes.subarray(start), extraZero);
  return res;
}

export class IndexedDbStamper implements ApiKeyStamperBase {
  constructor() {
    if (typeof window === "undefined") {
      throw new Error("IndexedDB is only available in the browser");
    }
  }

  private async openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeKeyPair(
    publicKeyHex: string,
    privateKey: CryptoKey,
  ): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.put(privateKey, publicKeyHex);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  private async getPrivateKey(publicKeyHex: string): Promise<CryptoKey | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const request = store.get(publicKeyHex);
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  async listKeyPairs(): Promise<string[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const request = store.getAllKeys();
      request.onsuccess = () => {
        db.close();
        resolve(request.result as string[]);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }

  async createKeyPair(externalKeyPair?: CryptoKeyPair): Promise<string> {
    let privateKey: CryptoKey;
    let publicKey: CryptoKey;
    if (externalKeyPair) {
      const extractable = (externalKeyPair.privateKey as any).extractable;
      if (extractable !== false) {
        throw new Error("Provided privateKey must be non-extractable.");
      }
      privateKey = externalKeyPair.privateKey;
      publicKey = externalKeyPair.publicKey;
    } else {
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign", "verify"],
      );
      privateKey = keyPair.privateKey;
      publicKey = keyPair.publicKey;
    }
    const rawPubKey = new Uint8Array(
      await crypto.subtle.exportKey("raw", publicKey),
    );
    const compressedPubKey = pointEncode(rawPubKey);
    const compressedHex = uint8ArrayToHexString(compressedPubKey);
    await this.storeKeyPair(compressedHex, privateKey);
    return compressedHex;
  }

  async deleteKeyPair(publicKeyHex: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.delete(publicKeyHex);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearKeyPairs(): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  private async sign(payload: string, publicKeyHex: string): Promise<string> {
    const privateKey = await this.getPrivateKey(publicKeyHex);
    if (!privateKey) {
      throw new Error("Key not found for publicKey: " + publicKeyHex);
    }
    const encodedPayload = new TextEncoder().encode(payload);
    const signatureIeee1363 = await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      privateKey,
      encodedPayload,
    );
    const signatureDer = convertEcdsaIeee1363ToDer(
      new Uint8Array(signatureIeee1363),
    );
    return uint8ArrayToHexString(signatureDer);
  }

  async stamp(payload: string, publicKeyHex: string): Promise<TStamp> {
    const signature = await this.sign(payload, publicKeyHex);
    const stamp = {
      publicKey: publicKeyHex,
      scheme: "SIGNATURE_SCHEME_TK_API_P256",
      signature,
    };
    return {
      stampHeaderName,
      stampHeaderValue: stringToBase64urlString(JSON.stringify(stamp)),
    };
  }
}
