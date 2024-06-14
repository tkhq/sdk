/// <reference lib="dom" />
import { p256 } from "@noble/curves/p256";
import * as hkdf from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { gcm } from "@noble/ciphers/aes";
import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
} from "@turnkey/encoding";
import bs58check from "bs58check";

import { modSqrt, testBit } from "./math";
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

interface HpkeDecryptParams {
  ciphertextBuf: Uint8Array;
  encappedKeyBuf: Uint8Array;
  receiverPriv: string;
}

interface HpkeEncryptParams {
  plainText: string;
  encappedKeyBuf: Uint8Array;
  senderPriv: string;
}

interface KeyPair {
  privateKey: string;
  publicKey: string;
  publicKeyUncompressed: string;
}

/**
 * Get PublicKey function
 * Derives public key from Uint8Array or hexstring private key
 *
 * @param {Uint8Array | string} privateKey - The Uint8Array or hexstring representation of a compressed private key.
 * @param {boolean} isCompressed - Specifies whether to return a compressed or uncompressed public key. Defaults to true.
 * @returns {Uint8Array} - The public key in Uin8Array representation.
 */
export const getPublicKey = (
  privateKey: Uint8Array | string,
  isCompressed: boolean = true
): Uint8Array => {
  return p256.getPublicKey(privateKey, isCompressed);
};

/**
 * HPKE Encrypt Function
 * Encrypts data using Hybrid Public Key Encryption (HPKE) standard https://datatracker.ietf.org/doc/rfc9180/.
 *
 * @param {HpkeEncryptParams} params - The encryption parameters including plain text, encapsulated key, and sender private key.
 * @returns {Uint8Array} - The encrypted data.
 */

export const hpkeEncrypt = ({
  plainText,
  encappedKeyBuf,
  senderPriv,
}: HpkeEncryptParams): Uint8Array => {
  try {
    const senderPubBuf = getPublicKey(
      uint8ArrayFromHexString(senderPriv),
      false
    );
    const aad = buildAdditionalAssociatedData(senderPubBuf, encappedKeyBuf);
    // Step 1: Convert the plain text string to a Uint8Array
    const plaintextBuf = new TextEncoder().encode(plainText);

    // Step 2: Derive the shared secret using the sender's private key and the encapsulated public key
    const ss = deriveSS(encappedKeyBuf, senderPriv);

    // Step 3: Generate the KEM context
    const kemContext = getKemContext(
      senderPubBuf,
      uint8ArrayToHexString(encappedKeyBuf)
    );

    // Step 4: Build the HKDF inputs for key derivation
    let ikm = buildLabeledIkm(LABEL_EAE_PRK, ss, SUITE_ID_1);
    let info = buildLabeledInfo(
      LABEL_SHARED_SECRET,
      kemContext,
      SUITE_ID_1,
      32
    );
    const sharedSecret = extractAndExpand(new Uint8Array([]), ikm, info, 32);

    // Step 5: Derive the AES encryption key
    ikm = buildLabeledIkm(LABEL_SECRET, new Uint8Array([]), SUITE_ID_2);
    info = AES_KEY_INFO;
    const key = extractAndExpand(sharedSecret, ikm, info, 32);

    // Step 6: Derive the initialization vector
    info = IV_INFO;
    const iv = extractAndExpand(sharedSecret, ikm, info, 12);

    // Step 7: Encrypt the data using AES-GCM
    const encryptedData = aesGcmEncrypt(plaintextBuf, key, iv, aad);

    // Step 8: Concatenate the encapsulated key and the encrypted data for output
    const compressedSenderBuf = compressRawPublicKey(senderPubBuf);
    const result = new Uint8Array(
      compressedSenderBuf.length + encryptedData.length
    );
    result.set(compressedSenderBuf, 0);
    result.set(encryptedData, compressedSenderBuf.length);

    return result;
  } catch (error) {
    throw new Error(`Unable to perform hpkeEncrypt: ${error}`);
  }
};

/**
 * HPKE Decrypt Function
 * Decrypts data using Hybrid Public Key Encryption (HPKE) standard https://datatracker.ietf.org/doc/rfc9180/.
 *
 * @param {HpkeDecryptParams} params - The decryption parameters including ciphertext, encapsulated key, and receiver private key.
 * @returns {Uint8Array} - The decrypted data.
 */
export const hpkeDecrypt = ({
  ciphertextBuf,
  encappedKeyBuf,
  receiverPriv,
}: HpkeDecryptParams): Uint8Array => {
  try {
    let ikm: Uint8Array;
    let info: Uint8Array;
    const receiverPubBuf = getPublicKey(
      uint8ArrayFromHexString(receiverPriv),
      false
    );
    const aad = buildAdditionalAssociatedData(encappedKeyBuf, receiverPubBuf);
    const kemContext = getKemContext(
      encappedKeyBuf,
      uint8ArrayToHexString(receiverPubBuf)
    );

    // Step 1: Generate Shared Secret
    const ss = deriveSS(encappedKeyBuf, receiverPriv);
    ikm = buildLabeledIkm(LABEL_EAE_PRK, ss, SUITE_ID_1);
    info = buildLabeledInfo(LABEL_SHARED_SECRET, kemContext, SUITE_ID_1, 32);
    const sharedSecret = extractAndExpand(new Uint8Array([]), ikm, info, 32);

    // Step 2: Get AES Key
    ikm = buildLabeledIkm(LABEL_SECRET, new Uint8Array([]), SUITE_ID_2);
    info = AES_KEY_INFO;
    const key = extractAndExpand(sharedSecret, ikm, info, 32);

    // Step 3: Get IV
    info = IV_INFO;
    const iv = extractAndExpand(sharedSecret, ikm, info, 12);

    // Step 4: Decrypt
    const decryptedData = aesGcmDecrypt(ciphertextBuf, key, iv, aad);
    return decryptedData;
  } catch (error) {
    throw new Error(`Unable to perform hpkeDecrypt: ${error} `);
  }
};

/**
 * Decrypt an encrypted email auth/recovery credential bundle.
 *
 * @param {string} credentialBundle - The encrypted credential bundle.
 * @param {string} embeddedKey - The private key for decryption.
 * @returns {Uint8Array} - The decrypted data or null if decryption fails.
 * @throws {Error} - If unable to decrypt the credential bundle
 */
export const decryptBundle = (
  credentialBundle: string,
  embeddedKey: string
): Uint8Array => {
  try {
    const bundleBytes = bs58check.decode(credentialBundle);
    if (bundleBytes.byteLength <= 33) {
      throw new Error(
        `Bundle size ${bundleBytes.byteLength} is too low. Expecting a compressed public key (33 bytes) and an encrypted credential.`
      );
    }

    const compressedEncappedKeyBuf = bundleBytes.slice(0, 33);
    const ciphertextBuf = bundleBytes.slice(33);
    const encappedKeyBuf = uncompressRawPublicKey(compressedEncappedKeyBuf);
    const decryptedData = hpkeDecrypt({
      ciphertextBuf,
      encappedKeyBuf,
      receiverPriv: embeddedKey,
    });

    return decryptedData;
  } catch (error) {
    throw new Error(`"Error injecting bundle:", ${error}`);
  }
};

/**
 * Generate a P-256 key pair. Contains the hexed privateKey, publicKey, and Uncompressed publicKey
 *
 * @returns {KeyPair} - The generated key pair.
 */
export const generateP256KeyPair = (): KeyPair => {
  const privateKey = randomBytes(32);
  const publicKey = getPublicKey(privateKey, true);
  const publicKeyUncompressed = uint8ArrayToHexString(
    uncompressRawPublicKey(publicKey)
  );
  return {
    privateKey: uint8ArrayToHexString(privateKey),
    publicKey: uint8ArrayToHexString(publicKey),
    publicKeyUncompressed,
  };
};

/**
 * Create additional associated data (AAD) for AES-GCM decryption.
 *
 * @param {Uint8Array} senderPubBuf
 * @param {Uint8Array} receiverPubBuf
 * @return {Uint8Array} - The resulting concatenation of sender and receiver pubkeys.
 */
export const buildAdditionalAssociatedData = (
  senderPubBuf: Uint8Array,
  receiverPubBuf: Uint8Array
): Uint8Array => {
  return new Uint8Array([
    ...Array.from(senderPubBuf),
    ...Array.from(receiverPubBuf),
  ]);
};

/**
 * Accepts a private key Uint8Array in the PKCS8 format, and returns the encapsulated private key.
 *
 * @param {Uint8Array} privateKey - A PKCS#8 private key structured with the key data at a specific position. The actual key starts at byte 36 and is 32 bytes long.
 * @return {Uint8Array} - The private key.
 */
export const extractPrivateKeyFromPKCS8Bytes = (
  privateKey: Uint8Array
): Uint8Array => {
  return privateKey.slice(36, 36 + 32);
};

/**
 * Accepts a public key Uint8Array, and returns a Uint8Array with the compressed version of the public key.
 *
 * @param {Uint8Array} rawPublicKey - The raw public key.
 * @return {Uint8Array} – The compressed public key.
 */
export const compressRawPublicKey = (rawPublicKey: Uint8Array): Uint8Array => {
  const len = rawPublicKey.byteLength;

  // Drop the y coordinate
  // Uncompressed key is in the form 0x04||x||y
  // `len >>> 1` is a more concise way to write `floor(len/2)`
  var compressedBytes = rawPublicKey.slice(0, (1 + len) >>> 1);

  // Encode the parity of `y` in first bit
  // `BYTE & 0x01` tests for parity and returns 0x00 when even, or 0x01 when odd
  // Then `0x02 | <parity test result>` yields either 0x02 (even case) or 0x03 (odd).
  compressedBytes[0] = 0x02 | (rawPublicKey[len - 1]! & 0x01);
  return compressedBytes;
};

/**
 * Accepts a public key array buffer, and returns a buffer with the uncompressed version of the public key
 * @param {Uint8Array} rawPublicKey - The public key.
 * @return {Uint8Array} - The uncompressed public key.
 */
export const uncompressRawPublicKey = (
  rawPublicKey: Uint8Array
): Uint8Array => {
  // point[0] must be 2 (false) or 3 (true).
  // this maps to the initial "02" or "03" prefix
  const lsb = rawPublicKey[0] === 3;
  const x = BigInt("0x" + uint8ArrayToHexString(rawPublicKey.subarray(1)));

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
  return uint8ArrayFromHexString(uncompressedHexString);
};

/**
 * Generate a random Uint8Array of a specific length. Note that this ultimately depends on the crypto implementation.
 */
const randomBytes = (length: number): Uint8Array => {
  const array = new Uint8Array(length);
  return crypto.getRandomValues(array);
};

/**
 * Build labeled Initial Key Material (IKM).
 *
 * @param {Uint8Array} label - The label to use.
 * @param {Uint8Array} ikm - The input key material.
 * @param {Uint8Array} suiteId - The suite identifier.
 * @returns {Uint8Array} - The labeled IKM.
 */
const buildLabeledIkm = (
  label: Uint8Array,
  ikm: Uint8Array,
  suiteId: Uint8Array
): Uint8Array => {
  const combinedLength =
    HPKE_VERSION.length + suiteId.length + label.length + ikm.length;
  const ret = new Uint8Array(combinedLength);
  let offset = 0;

  ret.set(HPKE_VERSION, offset);
  offset += HPKE_VERSION.length;

  ret.set(suiteId, offset);
  offset += suiteId.length;

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
 * @param {Uint8Array} suiteId - The suite identifier.
 * @param {number} len - The output length.
 * @returns {Uint8Array} - The labeled info.
 */
const buildLabeledInfo = (
  label: Uint8Array,
  info: Uint8Array,
  suiteId: Uint8Array,
  len: number
): Uint8Array => {
  const suiteIdStartIndex = 9; // first two are reserved for length bytes (unused in this case), the next 7 are for the HPKE_VERSION, then the suiteId starts at 9
  const ret = new Uint8Array(
    suiteIdStartIndex + suiteId.byteLength + label.byteLength + info.byteLength
  );
  ret.set(new Uint8Array([0, len]), 0); // this isn’t an error, we’re starting at index 2 because the first two bytes should be 0. See <https://github.com/dajiaji/hpke-js/blob/1e7fb1372fbcdb6d06bf2f4fa27ff676329d633e/src/kdfs/hkdf.ts#L41> for reference.
  ret.set(HPKE_VERSION, 2);
  ret.set(suiteId, suiteIdStartIndex);
  ret.set(label, suiteIdStartIndex + suiteId.byteLength);
  ret.set(info, suiteIdStartIndex + suiteId.byteLength + label.byteLength);
  return ret;
};

/**
 * Perform HKDF extract and expand operations.
 */
const extractAndExpand = (
  sharedSecret: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  len: number
): Uint8Array => {
  const prk = hkdf.extract(sha256, ikm, sharedSecret);
  const resp = hkdf.expand(sha256, prk, info, len);
  return new Uint8Array(resp);
};

/**
 * Derive the Diffie-Hellman shared secret using ECDH.
 */
const deriveSS = (encappedKeyBuf: Uint8Array, priv: string): Uint8Array => {
  const ss = p256.getSharedSecret(
    uint8ArrayFromHexString(priv),
    encappedKeyBuf
  );
  return ss.slice(1);
};

/**
 * Encrypt data using AES-GCM.
 */
const aesGcmEncrypt = (
  plaintextData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  aad?: Uint8Array
): Uint8Array => {
  const aes = gcm(key, iv, aad);
  const data = aes.encrypt(plaintextData);
  return data;
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
  const data = aes.decrypt(encryptedData);
  return data;
};

/**
 * Generate a Key Encapsulation Mechanism (KEM) context.
 */
const getKemContext = (
  encappedKeyBuf: Uint8Array,
  publicKey: string
): Uint8Array => {
  const encappedKeyArray = new Uint8Array(encappedKeyBuf);
  const publicKeyArray = uint8ArrayFromHexString(publicKey);

  const kemContext = new Uint8Array(
    encappedKeyArray.length + publicKeyArray.length
  );
  kemContext.set(encappedKeyArray);
  kemContext.set(publicKeyArray, encappedKeyArray.length);

  return kemContext;
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
