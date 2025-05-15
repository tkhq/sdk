import { uint8ArrayToHexString, stringToBase64urlString } from "@turnkey/encoding";

const DB_NAME = "TurnkeyStamperDB";
const DB_STORE = "KeyStore";
const DB_KEY = "turnkeyKeyPair";
const stampHeaderName = "X-Stamp";

function pointEncode(raw: Uint8Array): Uint8Array {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error("Invalid uncompressed P-256 key");
  }

  const x = raw.slice(1, 33);
  const y = raw.slice(33, 65);

  if (x.length !== 32 || y.length !== 32) {
    throw new Error("Invalid x or y length");
  }

  const prefix = (y[31]! & 1) === 0 ? 0x02 : 0x03;

  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}

/**
 * `SubtleCrypto.sign(...)` outputs signature in IEEE P1363 format:
 * - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign#ecdsa
 *
 * Turnkey expects the signature encoding to be DER-encoded ASN.1:
 * - https://github.com/tkhq/tkcli/blob/7f0159af5a73387ff050647180d1db4d3a3aa033/src/internal/apikey/apikey.go#L149
 *
 * Code modified from https://github.com/google/tink/blob/6f74b99a2bfe6677e3670799116a57268fd067fa/javascript/subtle/elliptic_curves.ts#L114
 *
 * Transform an ECDSA signature in IEEE 1363 encoding to DER encoding.
 *
 * @param ieee the ECDSA signature in IEEE encoding
 * @return ECDSA signature in DER encoding
 */
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
  let der;
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

/**
 * Code modified from https://github.com/google/tink/blob/6f74b99a2bfe6677e3670799116a57268fd067fa/javascript/subtle/elliptic_curves.ts#L311
 *
 * Transform a big integer in big endian to minimal unsigned form which has
 * no extra zero at the beginning except when the highest bit is set.
 */
function toUnsignedBigNum(bytes: Uint8Array): Uint8Array {
  // Remove zero prefixes.
  let start = 0;
  while (start < bytes.length && bytes[start] == 0) {
    start++;
  }
  if (start == bytes.length) {
    start = bytes.length - 1;
  }
  let extraZero = 0;

  // If the 1st bit is not zero, add 1 zero byte.
  if ((bytes[start]! & 128) == 128) {
    // Add extra zero.
    extraZero = 1;
  }
  const res = new Uint8Array(bytes.length - start + extraZero);
  res.set(bytes.subarray(start), extraZero);
  return res;
}



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

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        db.createObjectStore(DB_STORE);
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async storeKeyPair(publicKey: string, privateKey: CryptoKey): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);

      store.put(publicKey, `${DB_KEY}-pub`);
      store.put(privateKey, `${DB_KEY}-priv`);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  private async getStoredKeys(): Promise<{
    publicKey: string | null;
    privateKey: CryptoKey | null;
  }> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);

      const getPub = store.get(`${DB_KEY}-pub`);
      const getPriv = store.get(`${DB_KEY}-priv`);

      let publicKey: string | null = null;
      let privateKey: CryptoKey | null = null;

      getPub.onsuccess = () => (publicKey = getPub.result || null);
      getPriv.onsuccess = () => (privateKey = getPriv.result || null);

      tx.oncomplete = () => {
        db.close();
        resolve({ publicKey, privateKey });
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async init(): Promise<void> {
    const { publicKey, privateKey } = await this.getStoredKeys();

    if (publicKey && privateKey) {
      this.publicKeyHex = publicKey;
      this.privateKey = privateKey;
    } else {
      await this.resetKeyPair();
    }
  }

  async resetKeyPair(): Promise<void> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-256",
      },
      false,
      ["sign", "verify"]
    );

    const rawPubKey = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
    const compressedPubKey = pointEncode(rawPubKey);
    const compressedHex = uint8ArrayToHexString(compressedPubKey);

    await this.storeKeyPair(compressedHex, keyPair.privateKey);

    this.publicKeyHex = compressedHex;
    this.privateKey = keyPair.privateKey;
  }

  getPublicKey(): string | null {
    return this.publicKeyHex;
  }

  async sign(payload: string): Promise<string> {
    if (!this.privateKey) {
      throw new Error("Key not initialized. Call init() first.");
    }

    const encodedPayload = new TextEncoder().encode(payload);
    const signatureIeee1363 = await crypto.subtle.sign(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
      },
      this.privateKey,
      encodedPayload
    );

    const signatureDer = convertEcdsaIeee1363ToDer(new Uint8Array(signatureIeee1363));
    return uint8ArrayToHexString(signatureDer);
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

  async clear(): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);

      store.delete(`${DB_KEY}-pub`);
      store.delete(`${DB_KEY}-priv`);

      tx.oncomplete = () => {
        db.close();
        this.publicKeyHex = null;
        this.privateKey = null;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}
