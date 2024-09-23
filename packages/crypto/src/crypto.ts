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
  PRODUCTION_SIGNER_PUBLIC_KEY,
  SUITE_ID_1,
  SUITE_ID_2,
} from "./constants";
import bs58 from "bs58";
import { normalizePadding } from "@turnkey/encoding";
import { hexToAscii } from "@turnkey/encoding";

interface DecryptExportBundleParams {
  exportBundle: string;
  organizationId: string;
  embeddedKey: string;
  dangerouslyOverrideSignerPublicKey?: string; // Optional override for signer key
  returnMnemonic: boolean;
}
interface EncryptPrivateKeyToBundleParams {
  privateKey: string;
  keyFormat: string;
  importBundle: string;
  userId: string;
  organizationId: string;
  dangerouslyOverrideSignerPublicKey?: string; // Optional override for signer key
}

interface EncryptWalletToBundleParams {
  mnemonic: string;
  importBundle: string;
  userId: string;
  organizationId: string;
  dangerouslyOverrideSignerPublicKey?: string; // Optional override for signer key
}

interface HpkeDecryptParams {
  ciphertextBuf: Uint8Array;
  encappedKeyBuf: Uint8Array;
  receiverPriv: string;
}

interface HpkeEncryptParams {
  plainTextBuf: Uint8Array;
  targetKeyBuf: Uint8Array;
}
interface HpkeAuthEncryptParams {
  plainTextBuf: Uint8Array;
  targetKeyBuf: Uint8Array;
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
  plainTextBuf,
  targetKeyBuf,
}: HpkeEncryptParams): Uint8Array => {
  try {
    // Standard HPKE Mode (Ephemeral Key Pair)
    const ephemeralKeyPair = generateP256KeyPair();
    const senderPrivBuf = uint8ArrayFromHexString(ephemeralKeyPair.privateKey);
    const senderPubBuf = uint8ArrayFromHexString(
      ephemeralKeyPair.publicKeyUncompressed
    );

    const aad = buildAdditionalAssociatedData(senderPubBuf, targetKeyBuf);

    // Step 1: Generate Shared Secret
    const ss = deriveSS(targetKeyBuf, uint8ArrayToHexString(senderPrivBuf!));

    // Step 2: Generate the KEM context
    const kemContext = getKemContext(
      senderPubBuf,
      uint8ArrayToHexString(targetKeyBuf)
    );

    // Step 3: Build the HKDF inputs for key derivation
    let ikm = buildLabeledIkm(LABEL_EAE_PRK, ss, SUITE_ID_1);
    let info = buildLabeledInfo(
      LABEL_SHARED_SECRET,
      kemContext,
      SUITE_ID_1,
      32
    );
    const sharedSecret = extractAndExpand(new Uint8Array([]), ikm, info, 32);

    // Step 4: Derive the AES key
    ikm = buildLabeledIkm(LABEL_SECRET, new Uint8Array([]), SUITE_ID_2);
    info = AES_KEY_INFO;
    const key = extractAndExpand(sharedSecret, ikm, info, 32);

    // Step 5: Derive the initialization vector
    info = IV_INFO;
    const iv = extractAndExpand(sharedSecret, ikm, info, 12);

    // Step 6: Encrypt the data using AES-GCM
    const encryptedData = aesGcmEncrypt(plainTextBuf, key, iv, aad);

    // Step 7: Concatenate the encapsulated key and the encrypted data for output
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
 * HPKE Encrypt Function
 * Encrypts data using Authenticated ,Hybrid Public Key Encryption (HPKE) standard https://datatracker.ietf.org/doc/rfc9180/.
 *
 * @param {HpkeAuthEncryptParams} params - The encryption parameters including plain text, encapsulated key, and sender private key.
 * @returns {Uint8Array} - The encrypted data.
 */

export const hpkeAuthEncrypt = ({
  plainTextBuf,
  targetKeyBuf,
  senderPriv,
}: HpkeAuthEncryptParams): Uint8Array => {
  try {
    // Authenticated HPKE Mode
    const senderPrivBuf = uint8ArrayFromHexString(senderPriv);
    const senderPubBuf = getPublicKey(senderPriv, false);

    const aad = buildAdditionalAssociatedData(senderPubBuf, targetKeyBuf);

    // Step 1: Generate Shared Secret
    const ss = deriveSS(targetKeyBuf, uint8ArrayToHexString(senderPrivBuf!));

    // Step 2: Generate the KEM context
    const kemContext = getKemContext(
      senderPubBuf,
      uint8ArrayToHexString(targetKeyBuf)
    );

    // Step 3: Build the HKDF inputs for key derivation
    let ikm = buildLabeledIkm(LABEL_EAE_PRK, ss, SUITE_ID_1);
    let info = buildLabeledInfo(
      LABEL_SHARED_SECRET,
      kemContext,
      SUITE_ID_1,
      32
    );
    const sharedSecret = extractAndExpand(new Uint8Array([]), ikm, info, 32);

    // Step 4: Derive the AES key
    ikm = buildLabeledIkm(LABEL_SECRET, new Uint8Array([]), SUITE_ID_2);
    info = AES_KEY_INFO;
    const key = extractAndExpand(sharedSecret, ikm, info, 32);

    // Step 5: Derive the initialization vector
    info = IV_INFO;
    const iv = extractAndExpand(sharedSecret, ikm, info, 12);

    // Step 6: Encrypt the data using AES-GCM
    const encryptedData = aesGcmEncrypt(plainTextBuf, key, iv, aad);

    // Step 7: Concatenate the encapsulated key and the encrypted data for output
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
 * Format HPKE Buffer Function
 * Returns a JSON string of an encrypted bundle, separating out the cipher text and the sender public key
 *
 * @param {Uint8Array} encryptedBuf - The result of hpkeAuthEncrypt or hpkeEncrypt
 * @returns {string} - A JSON string with "encappedPublic" and "ciphertext"
 */

export const formatHpkeBuf = (encryptedBuf: Uint8Array): string => {
  const compressedSenderBuf = encryptedBuf.slice(0, 33);
  const encryptedData = encryptedBuf.slice(33);

  const encappedKeyBufHex = uint8ArrayToHexString(
    uncompressRawPublicKey(compressedSenderBuf)
  );
  const ciphertextHex = uint8ArrayToHexString(encryptedData);

  return JSON.stringify({
    encappedPublic: encappedKeyBufHex,
    ciphertext: ciphertextHex,
  });
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
    const aad = buildAdditionalAssociatedData(encappedKeyBuf, receiverPubBuf); // Eventually we want users to be able to pass in aad as optional

    // Step 1: Generate Shared Secret
    const ss = deriveSS(encappedKeyBuf, receiverPriv);

    // Step 2: Generate the KEM context
    const kemContext = getKemContext(
      encappedKeyBuf,
      uint8ArrayToHexString(receiverPubBuf)
    );

    // Step 3: Build the HKDF inputs for key derivation
    ikm = buildLabeledIkm(LABEL_EAE_PRK, ss, SUITE_ID_1);
    info = buildLabeledInfo(LABEL_SHARED_SECRET, kemContext, SUITE_ID_1, 32);
    const sharedSecret = extractAndExpand(new Uint8Array([]), ikm, info, 32);

    // Step 4: Derive the AES key
    ikm = buildLabeledIkm(LABEL_SECRET, new Uint8Array([]), SUITE_ID_2);
    info = AES_KEY_INFO;
    const key = extractAndExpand(sharedSecret, ikm, info, 32);

    // Step 5: Derive the initialization vector
    info = IV_INFO;
    const iv = extractAndExpand(sharedSecret, ikm, info, 12);

    // Step 6: Decrypt the data using AES-GCM
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
 * @returns {string} - The decrypted data or null if decryption fails.
 * @throws {Error} - If unable to decrypt the credential bundle
 */
export const decryptEmailBundle = (
  credentialBundle: string,
  embeddedKey: string
): string => {
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

    return uint8ArrayToHexString(decryptedData);
  } catch (error) {
    throw new Error(`"Error decrypting bundle:", ${error}`);
  }
};

/**
 * Decrypt an encrypted export bundle (such as a private key or wallet account bundle).
 *
 * This function verifies the enclave signature to ensure the authenticity of the encrypted data.
 * It uses HPKE (Hybrid Public Key Encryption) to decrypt the contents of the bundle and returns
 * either the decrypted mnemonic or the decrypted data in hexadecimal format, based on the
 * `returnMnemonic` flag.
 *
 * @param {DecryptExportBundleParams} params - An object containing the following properties:
 *   - exportBundle {string}: The encrypted export bundle in JSON format.
 *   - organizationId {string}: The expected organization ID to verify against the signed data.
 *   - embeddedKey {string}: The private key used for decrypting the data.
 *   - dangerouslyOverrideSignerPublicKey {string} [Optional]: Optionally override the default signer public key used for verifying the signature. This should only be done for testing
 *   - returnMnemonic {boolean}: If true, returns the decrypted data as a mnemonic string; otherwise, returns it in hexadecimal format.
 * @returns {Promise<string>} - A promise that resolves to the decrypted mnemonic or decrypted hexadecimal data.
 * @throws {Error} - If decryption or signature verification fails, throws an error with details.
 */
export const decryptExportBundle = async ({
  exportBundle,
  embeddedKey,
  organizationId,
  dangerouslyOverrideSignerPublicKey,
  returnMnemonic,
}: DecryptExportBundleParams) => {
  try {
    const parsedExportBundle = JSON.parse(exportBundle);
    const verified = await verifyEnclaveSignature(
      parsedExportBundle.enclaveQuorumPublic,
      parsedExportBundle.dataSignature,
      parsedExportBundle.data,
      dangerouslyOverrideSignerPublicKey
    );
    if (!verified) {
      throw new Error(
        `failed to verify enclave signature: ${parsedExportBundle}`
      );
    }

    const signedData = JSON.parse(
      new TextDecoder().decode(uint8ArrayFromHexString(parsedExportBundle.data))
    );

    if (
      !signedData.organizationId ||
      signedData.organizationId !== organizationId
    ) {
      throw new Error(
        `organization id does not match expected value. Expected: ${organizationId}. Found: ${signedData.organizationId}.`
      );
    }
    if (!signedData.encappedPublic) {
      throw new Error('missing "encappedPublic" in bundle signed data');
    }

    const encappedKeyBuf = uint8ArrayFromHexString(signedData.encappedPublic);
    const ciphertextBuf = uint8ArrayFromHexString(signedData.ciphertext);
    const decryptedData = hpkeDecrypt({
      ciphertextBuf,
      encappedKeyBuf,
      receiverPriv: embeddedKey,
    });

    const decryptedDataHex = uint8ArrayToHexString(decryptedData);
    return returnMnemonic ? hexToAscii(decryptedDataHex) : decryptedDataHex;
  } catch (error) {
    throw new Error(`"Error decrypting bundle:", ${error}`);
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
  plainTextData: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  aad?: Uint8Array
): Uint8Array => {
  const aes = gcm(key, iv, aad);
  const data = aes.encrypt(plainTextData);
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

/**
 * Verifies a signature from a Turnkey enclave using ECDSA and SHA-256.
 *
 * @param {string} enclaveQuorumPublic - The public key of the enclave signer.
 * @param {string} publicSignature - The ECDSA signature in DER format.
 * @param {string} signedData - The data that was signed.
 * @param {Environemnt} environment - An enum PROD or PREPROD to verify against the correct signer enclave key
 * @returns {Promise<boolean>} - Returns true if the signature is valid, otherwise throws an error.
 */

const verifyEnclaveSignature = async (
  enclaveQuorumPublic: string,
  publicSignature: string,
  signedData: string,
  dangerouslyOverrideSignerPublicKey?: string
) => {
  const expectedSignerPublicKey =
    dangerouslyOverrideSignerPublicKey || PRODUCTION_SIGNER_PUBLIC_KEY;
  if (enclaveQuorumPublic != expectedSignerPublicKey) {
    throw new Error(
      `expected signer key ${
        dangerouslyOverrideSignerPublicKey ?? PRODUCTION_SIGNER_PUBLIC_KEY
      } does not match signer key from bundle: ${enclaveQuorumPublic}`
    );
  }

  const encryptionQuorumPublicBuf = new Uint8Array(
    uint8ArrayFromHexString(enclaveQuorumPublic)
  );
  const quorumKey = await loadQuorumKey(encryptionQuorumPublicBuf);
  if (!quorumKey) {
    throw new Error("failed to load quorum key");
  }

  // The ECDSA signature is ASN.1 DER encoded but WebCrypto uses raw format
  const publicSignatureBuf = fromDerSignature(publicSignature);
  const signedDataBuf = uint8ArrayFromHexString(signedData);
  return await crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    quorumKey,
    publicSignatureBuf,
    signedDataBuf
  );
};

/**
 * Converts an ASN.1 DER-encoded ECDSA signature to the raw format that WebCrypto uses.
 *
 * @param {string} derSignature - The DER-encoded signature.
 * @returns {Uint8Array} - The raw signature.
 */
const fromDerSignature = (derSignature: string) => {
  const derSignatureBuf = uint8ArrayFromHexString(derSignature);

  // Check and skip the sequence tag (0x30)
  let index = 2;

  // Parse 'r' and check for integer tag (0x02)
  if (derSignatureBuf[index] !== 0x02) {
    throw new Error(
      "failed to convert DER-encoded signature: invalid tag for r"
    );
  }
  index++; // Move past the INTEGER tag
  const rLength = derSignatureBuf[index];
  index++; // Move past the length byte
  const r = derSignatureBuf.slice(index, index + rLength!);
  index += rLength!; // Move to the start of s

  // Parse 's' and check for integer tag (0x02)
  if (derSignatureBuf[index] !== 0x02) {
    throw new Error(
      "failed to convert DER-encoded signature: invalid tag for s"
    );
  }
  index++; // Move past the INTEGER tag
  const sLength = derSignatureBuf[index];
  index++; // Move past the length byte
  const s = derSignatureBuf.slice(index, index + sLength!);

  // Normalize 'r' and 's' to 32 bytes each
  const rPadded = normalizePadding(r, 32);
  const sPadded = normalizePadding(s, 32);

  // Concatenate and return the raw signature
  return new Uint8Array([...rPadded, ...sPadded]);
};

/**
 * Loads an ECDSA public key from a raw format for signature verification.
 *
 * @param {Uint8Array} quorumPublic - The raw public key bytes.
 * @returns {Promise<CryptoKey>} - The imported ECDSA public key.
 */
const loadQuorumKey = async (quorumPublic: Uint8Array): Promise<CryptoKey> => {
  return await crypto.subtle.importKey(
    "raw",
    quorumPublic,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["verify"]
  );
};

/**
 * Decodes a private key based on the specified format.
 *
 * @param {string} privateKey - The private key to decode.
 * @param {string} keyFormat - The format of the private key (e.g., "SOLANA", "HEXADECIMAL").
 * @returns {Uint8Array} - The decoded private key.
 */

const decodeKey = (privateKey: string, keyFormat: any): Uint8Array => {
  switch (keyFormat) {
    case "SOLANA":
      const decodedKeyBytes = bs58.decode(privateKey);
      if (decodedKeyBytes.length !== 64) {
        throw new Error(
          `invalid key length. Expected 64 bytes. Got ${decodedKeyBytes.length}.`
        );
      }
      return decodedKeyBytes.subarray(0, 32);
    case "HEXADECIMAL":
      if (privateKey.startsWith("0x")) {
        return uint8ArrayFromHexString(privateKey.slice(2));
      }
      return uint8ArrayFromHexString(privateKey);
    default:
      console.warn(
        `invalid key format: ${keyFormat}. Defaulting to HEXADECIMAL.`
      );
      if (privateKey.startsWith("0x")) {
        return uint8ArrayFromHexString(privateKey.slice(2));
      }
      return uint8ArrayFromHexString(privateKey);
  }
};

/**
 * Encrypts a private key bundle using HPKE and verifies the enclave signature.
 *
 * @param {EncryptPrivateKeyToBundleParams} params - An object containing the private key, key format, bundle, user, and organization details. Optionally, you can override the default signer key (for testing purposes)
 * @returns {Promise<string>} - A promise that resolves to a JSON string representing the encrypted bundle.
 * @throws {Error} - If enclave signature verification or any other validation fails.
 */
export const encryptPrivateKeyToBundle = async ({
  privateKey,
  keyFormat,
  importBundle,
  userId,
  organizationId,
  dangerouslyOverrideSignerPublicKey,
}: EncryptPrivateKeyToBundleParams): Promise<string> => {
  const parsedImportBundle = JSON.parse(importBundle);
  const plainTextBuf = decodeKey(privateKey, keyFormat);
  const verified = await verifyEnclaveSignature(
    parsedImportBundle.enclaveQuorumPublic,
    parsedImportBundle.dataSignature,
    parsedImportBundle.data,
    dangerouslyOverrideSignerPublicKey
  );
  if (!verified) {
    throw new Error(`failed to verify enclave signature: ${importBundle}`);
  }

  const signedData = JSON.parse(
    new TextDecoder().decode(uint8ArrayFromHexString(parsedImportBundle.data))
  );

  if (
    !signedData.organizationId ||
    signedData.organizationId !== organizationId
  ) {
    throw new Error(
      `organization id does not match expected value. Expected: ${organizationId}. Found: ${signedData.organizationId}.`
    );
  }
  if (!signedData.userId || signedData.userId !== userId) {
    throw new Error(
      `user id does not match expected value. Expected: ${userId}. Found: ${signedData.userId}.`
    );
  }

  if (!signedData.targetPublic) {
    throw new Error('missing "targetPublic" in bundle signed data');
  }

  // Load target public key generated from enclave and set in local storage
  const targetKeyBuf = uint8ArrayFromHexString(signedData.targetPublic);
  const privateKeyBundle = hpkeEncrypt({ plainTextBuf, targetKeyBuf });
  return formatHpkeBuf(privateKeyBundle);
};

/**
/**
 * Encrypts a mnemonic wallet bundle using HPKE and verifies the enclave signature.
 *
 * @param {EncryptWalletToBundleParams} params - An object containing the mnemonic, bundle, user, and organization details. Optionally, you can override the default signer key (for testing purposes).
 * @returns {Promise<string>} - A promise that resolves to a JSON string representing the encrypted wallet bundle.
 * @throws {Error} - If enclave signature verification or any other validation fails.
 */
export const encryptWalletToBundle = async ({
  mnemonic,
  importBundle,
  userId,
  organizationId,
  dangerouslyOverrideSignerPublicKey,
}: EncryptWalletToBundleParams): Promise<string> => {
  const parsedImportBundle = JSON.parse(importBundle);
  const plainTextBuf = new TextEncoder().encode(mnemonic);
  const verified = await verifyEnclaveSignature(
    parsedImportBundle.enclaveQuorumPublic,
    parsedImportBundle.dataSignature,
    parsedImportBundle.data,
    dangerouslyOverrideSignerPublicKey
  );
  if (!verified) {
    throw new Error(`failed to verify enclave signature: ${importBundle}`);
  }

  const signedData = JSON.parse(
    new TextDecoder().decode(uint8ArrayFromHexString(parsedImportBundle.data))
  );

  if (
    !signedData.organizationId ||
    signedData.organizationId !== organizationId
  ) {
    throw new Error(
      `organization id does not match expected value. Expected: ${organizationId}. Found: ${signedData.organizationId}.`
    );
  }
  if (!signedData.userId || signedData.userId !== userId) {
    throw new Error(
      `user id does not match expected value. Expected: ${userId}. Found: ${signedData.userId}.`
    );
  }

  if (!signedData.targetPublic) {
    throw new Error('missing "targetPublic" in bundle signed data');
  }

  // Load target public key generated from enclave and set in local storage
  const targetKeyBuf = uint8ArrayFromHexString(signedData.targetPublic);
  const privateKeyBundle = hpkeEncrypt({ plainTextBuf, targetKeyBuf });
  return formatHpkeBuf(privateKeyBundle);
};
