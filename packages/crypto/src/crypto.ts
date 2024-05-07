import { btoa, atob } from "react-native-quick-base64";
import { p256 } from "@noble/curves/p256";
import * as hkdf from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { gcm } from "@noble/ciphers/aes";
import * as bs58check from "bs58check";

import {
  AES_KEY_INFO,
  HPKE_VERSION,
  IV_INFO,
  LABEL_EAE_PRK,
  LABEL_SECRET,
  LABEL_SHARED_SECRET,
  SUITE_ID_1,
  SUITE_ID_2,
} from "./constants";

interface HPKEDecyptParams {
  ciphertextBuf: Uint8Array;
  encappedKeyBuf: Uint8Array;
  receiverPriv: string;
}

interface KeyPair {
  privateKey: string;
  publicKey: Uint8Array | string;
  publicKeyUncompressed?: string;
}

/**
 * HPKE Decrypt Function
 * Decrypts data using Hybrid Public Key Encryption (HPKE) approach.
 *
 * @param {HPKEDecyptParams} params - The decryption parameters including ciphertext, encapsulated key, and receiver private key.
 * @returns {Promise<Uint8Array>} - The decrypted data.
 */
export const hpkeDecrypt = async ({
  ciphertextBuf,
  encappedKeyBuf,
  receiverPriv,
}: HPKEDecyptParams): Promise<Uint8Array> => {
  try {
    let ikm: Uint8Array;
    let info: Uint8Array;
    const receiverPubBuf = await p256.getPublicKey(
      base64urlDecode(receiverPriv),
      false
    );
    const aad = additionalAssociatedData(encappedKeyBuf, receiverPubBuf);
    const kemContext = getKemContext(
      encappedKeyBuf,
      uint8arrayToHexString(receiverPubBuf)
    );

    // Step 1: Generate Shared Secret
    const dh = await deriveDh(encappedKeyBuf, receiverPriv);
    ikm = buildLabeledIkm(LABEL_EAE_PRK, dh, SUITE_ID_1);
    info = buildLabeledInfo(LABEL_SHARED_SECRET, kemContext, SUITE_ID_1, 32);
    const sharedSecret = await extractAndExpand(
      new Uint8Array([]),
      ikm,
      info,
      32
    );

    // Step 2: Get AES Key
    ikm = buildLabeledIkm(LABEL_SECRET, new Uint8Array([]), SUITE_ID_2);
    info = AES_KEY_INFO;
    const key = await extractAndExpand(sharedSecret, ikm, info, 32);

    // Step 3: Get IV
    info = IV_INFO;
    const iv = await extractAndExpand(sharedSecret, ikm, info, 12);

    // Step 4: Decrypt
    const decryptedData = await aesGcmDecrypt(ciphertextBuf, key, iv, aad);
    return decryptedData;
  } catch (error) {
    console.error("Decryption Error:", error);
    throw error;
  }
};

/**
 * Convert a string to a base64url-encoded string.
 *
 * @param {string} input - The input string to encode.
 * @returns {string} - The base64url-encoded string.
 */
export const stringToBase64urlString = (input: string): string => {
  const base64String = btoa(input);
  return base64StringToBase64UrlEncodedString(base64String);
};

/**
 * Convert a base64 string to a base64url-encoded string.
 *
 * @param {string} input - The base64 string to convert.
 * @returns {string} - The base64url-encoded string.
 */
export const base64StringToBase64UrlEncodedString = (input: string): string => {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

/**
 * Decrypt an encrypted credential bundle.
 *
 * @param {string} credentialBundle - The encrypted credential bundle.
 * @param {string} embeddedKey - The private key for decryption.
 * @returns {Promise<Uint8Array | null>} - The decrypted data or null if decryption fails.
 */
export const decryptBundle = async (
  credentialBundle: string,
  embeddedKey: string
): Promise<Uint8Array | null> => {
  try {
    let bundleBytes: Uint8Array;

    // Decode using either Base58Check or Base64URL
    if (
      credentialBundle.indexOf("-") === -1 &&
      credentialBundle.indexOf("_") === -1 &&
      credentialBundle.indexOf("O") === -1 &&
      credentialBundle.indexOf("I") === -1 &&
      credentialBundle.indexOf("l") === -1 &&
      credentialBundle.indexOf("0") === -1
    ) {
      bundleBytes = bs58check.decode(credentialBundle);
    } else {
      bundleBytes = base64urlDecode(credentialBundle);
    }

    if (bundleBytes.byteLength <= 33) {
      throw new Error(
        `Bundle size ${bundleBytes.byteLength} is too low. Expecting a compressed public key (33 bytes) and an encrypted credential.`
      );
    }

    const compressedEncappedKeyBuf = bundleBytes.slice(0, 33);
    const ciphertextBuf = bundleBytes.slice(33);
    const encappedKeyBuf = uncompressRawPublicKey(compressedEncappedKeyBuf);
    const decryptedData = await hpkeDecrypt({
      ciphertextBuf,
      encappedKeyBuf,
      receiverPriv: embeddedKey,
    });

    return decryptedData;
  } catch (error) {
    console.error("Error injecting bundle:", error);
    return null;
  }
};

/**
 * Encode a Uint8Array to a base64url-encoded string.
 *
 * @param {Uint8Array} data - The data to encode.
 * @returns {string} - The base64url-encoded string.
 */
export const base64urlEncode = (data: Uint8Array): string => {
  let binary = "";
  data.forEach((byte) => (binary += String.fromCharCode(byte)));
  const base64String = btoa(binary);
  return base64String
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/**
 * Decode a base64url-encoded string to a Uint8Array.
 *
 * @param {string} base64url - The base64url-encoded string to decode.
 * @returns {Uint8Array} - The decoded data.
 */
export const base64urlDecode = (base64url: string): Uint8Array => {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4 === 0 ? "" : "===".slice(0, 4 - (base64.length % 4));
  const binaryString = atob(base64 + padding);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Generate a target key pair using P-256.
 *
 * @returns {Promise<KeyPair>} - The generated key pair.
 */
export const generateTargetKey = async (): Promise<KeyPair> => {
  const privateKey = randomBytes(32);
  const publicKey = p256.getPublicKey(privateKey, false);
  return { privateKey: base64urlEncode(privateKey), publicKey };
};

/**
 * Generate a P-256 key pair.
 *
 * @returns {Promise<KeyPair>} - The generated key pair.
 */
export const generateP256KeyPair = async (): Promise<KeyPair> => {
  const privateKey = randomBytes(32);
  const publicKey = p256.getPublicKey(privateKey, true);
  const publicKeyUncompressed = uint8arrayToHexString(
    uncompressRawPublicKey(publicKey)
  );
  return {
    privateKey: uint8arrayToHexString(privateKey),
    publicKey: uint8arrayToHexString(privateKey),
    publicKeyUncompressed,
  };
};
/**
 * Convert a hexadecimal string to a Uint8Array.
 *
 * @param {string} hexString - The hexadecimal string.
 * @returns {Uint8Array} - The Uint8Array representation.
 * @throws {Error} - If the hexadecimal string is invalid.
 */
export const uint8arrayFromHexString = (hexString: string): Uint8Array => {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  if (!hexString || hexString.length % 2 != 0 || !hexRegex.test(hexString)) {
    throw new Error(
      `cannot create uint8array from invalid hex string: "${hexString}"`
    );
  }
  return new Uint8Array(
    hexString!.match(/../g)!.map((h: string) => parseInt(h, 16))
  );
};

/**
 * Convert a Uint8Array to a hexadecimal string.
 *  @param {any} array - A Uint8Array (type is any to overcome a typescript error)
 */
export const uint8arrayToHexString = (array: any) => {
  return [...array].map((x) => x.toString(16).padStart(2, "0")).join("");
};

/**
 * Build labeled Initial Key Material (IKM).
 *
 * @param {Uint8Array} label - The label to use.
 * @param {Uint8Array} ikm - The input key material.
 * @param {Uint8Array} suite_id - The suite identifier.
 * @returns {Uint8Array} - The labeled IKM.
 */
const buildLabeledIkm = (
  label: Uint8Array,
  ikm: Uint8Array,
  suite_id: Uint8Array
): Uint8Array => {
  const combinedLength =
    HPKE_VERSION.length + suite_id.length + label.length + ikm.length;
  const ret = new Uint8Array(combinedLength);
  let offset = 0;

  ret.set(HPKE_VERSION, offset);
  offset += HPKE_VERSION.length;

  ret.set(suite_id, offset);
  offset += suite_id.length;

  ret.set(label, offset);
  offset += label.length;

  ret.set(ikm, offset);

  return ret;
};

/**
 * Build labeled info for HKDF operations.
 *
 * @param {Uint8Array} label - The label to use.
 * @param {Uint8Array} info - Additional information.
 * @param {Uint8Array} suite_id - The suite identifier.
 * @param {number} len - The output length.
 * @returns {Uint8Array} - The labeled info.
 */
const buildLabeledInfo = (
  label: Uint8Array,
  info: Uint8Array,
  suite_id: Uint8Array,
  len: number
): Uint8Array => {
  const ret = new Uint8Array(
    9 + suite_id.byteLength + label.byteLength + info.byteLength
  );
  ret.set(new Uint8Array([0, len]), 0);
  ret.set(HPKE_VERSION, 2);
  ret.set(suite_id, 9);
  ret.set(label, 9 + suite_id.byteLength);
  ret.set(info, 9 + suite_id.byteLength + label.byteLength);
  return ret;
};

/**
 * Convert a BigInt to a hexadecimal string of a specific length.
 */
const bigIntToHex = (num: bigint, length: number): string => {
  const hexString = num.toString(16);
  if (hexString.length > length) {
    throw new Error(
      `number cannot fit in a hex string of ${length} characters`
    );
  }
  return hexString.padStart(length, "0");
};

/**
 * Uncompress a raw public key.
 */

const uncompressRawPublicKey = (rawPublicKey: Uint8Array):Uint8Array =>{ 
  // point[0] must be 2 (false) or 3 (true).
  // this maps to the initial "02" or "03" prefix
  const lsb = rawPublicKey[0] === 3;
  const x = BigInt("0x" + uint8arrayToHexString(rawPublicKey.subarray(1)));

  // https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf (Appendix D).
  const p = BigInt(
    "115792089210356248762697446949407573530086143415290314195533631308867097853951"
  );
  const b = BigInt(
    "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b "
  );
  const a = p - BigInt(3);

  // Now compute y based on x
  const rhs = ((x * x + a) * x + b) % p;
  let y = modSqrt(rhs, p);
  if (lsb !== testBit(y, 0)) {
    y = (p - y) % p;
  }

  if (x < BigInt(0) || x >= p) {
    throw new Error("x is out of range");
  }

  if (y < BigInt(0) || y >= p) {
    throw new Error("y is out of range");
  }

  var uncompressedHexString = "04" + bigIntToHex(x, 64) + bigIntToHex(y, 64);
  return uint8arrayFromHexString(uncompressedHexString);
};
/**
 * Compute the modular square root using the Tonelli-Shanks algorithm.
 */

const modSqrt = (x: bigint, p: bigint): bigint => {
  if (p <= BigInt(0)) {
    throw new Error("p must be positive");
  }
  const base = x % p;

  // Check if p % 4 == 3 (applies to NIST curves P-256, P-384, and P-521)
  if (testBit(p, 0) && testBit(p, 1)) {
    const q = (p + BigInt(1)) >> BigInt(2);
    const squareRoot = modPow(base, q, p);
    if ((squareRoot * squareRoot) % p !== base) {
      throw new Error("could not find a modular square root");
    }
    return squareRoot;
  }

  // Other elliptic curve types not supported
  throw new Error("unsupported modulus value");
};

/**
 * Compute the modular exponentiation.
 */
const modPow = (b: bigint, exp: bigint, p: bigint): bigint => {
  if (exp === BigInt(0)) {
    return BigInt(1);
  }
  let result = b;
  const exponentBitString = exp.toString(2);
  for (let i = 1; i < exponentBitString.length; ++i) {
    result = (result * result) % p;
    if (exponentBitString[i] === "1") {
      result = (result * b) % p;
    }
  }
  return result;
};

/**
 * Test if a specific bit is set.
 */
const testBit = (n: bigint, i: number): boolean => {
  const m = BigInt(1) << BigInt(i);
  return (n & m) !== BigInt(0);
};

/**
 * Generate a random Uint8Array of a specific length.
 */
const randomBytes = (length: number): Uint8Array => {
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    array[i] = Math.floor(Math.random() * 256);
  }
  return array;
};

/**
 * Create additional associated data (AAD) for AES-GCM decryption.
 */
const additionalAssociatedData = (
  senderPubBuf: ArrayBuffer,
  receiverPubBuf: ArrayBuffer
): Uint8Array => {
  const s = Array.from(new Uint8Array(senderPubBuf));
  const r = Array.from(new Uint8Array(receiverPubBuf));
  return new Uint8Array([...s, ...r]);
};

/**
 * Perform HKDF extract and expand operations.
 */
const extractAndExpand = async (
  sharedSecret: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  len: number
): Promise<Uint8Array> => {
  const prk = hkdf.extract(sha256, ikm, sharedSecret);
  const resp = hkdf.expand(sha256, prk, info, len);
  return new Uint8Array(resp);
};

/**
 * Derive the Diffie-Hellman (DH) shared secret using ECDH.
 */
const deriveDh = async (
  encappedKeyBuf: Uint8Array,
  receiverPriv: string
): Promise<Uint8Array> => {
  const dh = p256.getSharedSecret(
    base64urlDecode(receiverPriv),
    encappedKeyBuf
  );
  return dh.slice(1);
};

/**
 * Decrypt data using AES-GCM.
 */
const aesGcmDecrypt = (
  encryptedData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  aad?: Uint8Array
): Uint8Array => {
  const aes = gcm(key, iv, aad);
  const data_ = aes.decrypt(encryptedData);
  return data_;
};

/**
 * Generate a Key Encapsulation Mechanism (KEM) context.
 */
const getKemContext = (
  encappedKeyBuf: Uint8Array,
  publicKey: string
): Uint8Array => {
  const encappedKeyArray = new Uint8Array(encappedKeyBuf);
  const publicKeyArray = uint8arrayFromHexString(publicKey);

  const kemContext = new Uint8Array(
    encappedKeyArray.length + publicKeyArray.length
  );
  kemContext.set(encappedKeyArray);
  kemContext.set(publicKeyArray, encappedKeyArray.length);

  return kemContext;
};
