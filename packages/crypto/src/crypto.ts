/// <reference lib="dom" />
import { p256 } from "@noble/curves/p256";
import * as hkdf from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";
import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/hashes/utils";
import * as borsh from "borsh";

import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
  normalizePadding,
} from "@turnkey/encoding";

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
  QOS_ENCRYPTION_HMAC_MESSAGE,
} from "./constants";

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

// Envelope for serializing an encrypted message with it's context.
type Envelope = {
  nonce: Uint8Array;
  ephemeralSenderPublic: Uint8Array;
  encryptedMessage: Uint8Array;
};

// schema for borsh serialization
const EnvelopeSchema = {
  struct: {
    nonce: { array: { type: "u8", len: 12 } },
    ephemeralSenderPublic: { array: { type: "u8", len: 65 } },
    encryptedMessage: { array: { type: "u8" } },
  },
};

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
  isCompressed: boolean = true,
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
      ephemeralKeyPair.publicKeyUncompressed,
    );

    const aad = buildAdditionalAssociatedData(senderPubBuf, targetKeyBuf);

    // Step 1: Generate Shared Secret
    const ss = deriveSS(targetKeyBuf, uint8ArrayToHexString(senderPrivBuf!));

    // Step 2: Generate the KEM context
    const kemContext = getKemContext(
      senderPubBuf,
      uint8ArrayToHexString(targetKeyBuf),
    );

    // Step 3: Build the HKDF inputs for key derivation
    let ikm = buildLabeledIkm(LABEL_EAE_PRK, ss, SUITE_ID_1);
    let info = buildLabeledInfo(
      LABEL_SHARED_SECRET,
      kemContext,
      SUITE_ID_1,
      32,
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
      compressedSenderBuf.length + encryptedData.length,
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
      uint8ArrayToHexString(targetKeyBuf),
    );

    // Step 3: Build the HKDF inputs for key derivation
    let ikm = buildLabeledIkm(LABEL_EAE_PRK, ss, SUITE_ID_1);
    let info = buildLabeledInfo(
      LABEL_SHARED_SECRET,
      kemContext,
      SUITE_ID_1,
      32,
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
      compressedSenderBuf.length + encryptedData.length,
    );
    result.set(compressedSenderBuf, 0);
    result.set(encryptedData, compressedSenderBuf.length);
    return result;
  } catch (error) {
    throw new Error(`Unable to perform hpkeEncrypt: ${error}`);
  }
};

/**
 * Encrypt a message to a quorum key. Algorithm originally implemented in qos here: https://github.com/tkhq/qos/blob/ae01904c756107f850aea42000137ef124df3fe4/src/qos_p256/src/encrypt.rs#L123
 * Returns a borsh serialized encrypted Envelope which is the nonce + ephemeralSenderPublicKey + encryptedMessage
 * This function creates an ephemeral key, creates a shared secret with the recipient targetPublicKeyUncompressed
 * creates additional associated data which follows the form: sender_public||sender_public_len||receiver_public||receiver_public_len
 * encrypts using aes-gcm-256 with a SHA-512 HMAC over the QOS_ENCRYPTION_HMAC_MESSAGE literally: "qos_encryption_hmac_message"
 * inserts and returns the necessary information in a borsh serialized envelope as described above
 * This encryption function is meant to be used with this decryption function in QOS: https://github.com/tkhq/qos/blob/ae01904c756107f850aea42000137ef124df3fe4/src/qos_p256/src/encrypt.rs#L52
 *
 * @param {Uint8Array} targetPublicKeyUncompressed - The P256 uncompressed public key to encrypt the message to
 * @param {Uint8Array} message - The message to encrypt to targetPublicKeyUncompressed
 * @returns {Uint8Array} - A borsh serialized envelope containing the nonce + ephemeralSenderPublicKey + encrypted message
 */
export const quorumKeyEncrypt = async (
  targetPublicKeyUncompressed: Uint8Array,
  message: Uint8Array,
): Promise<Uint8Array> => {
  // generate an ephemeral keypair for this encryption operation
  const ephemeralKeyPair = generateP256KeyPair();
  const ephemeralSenderPublic = ephemeralKeyPair.publicKeyUncompressed;

  // create a shared secret AES-GCM key with the SHA-512 HMAC
  let cipher = await createQuorumKeyEncryptCipher(
    uint8ArrayFromHexString(ephemeralSenderPublic),
    uint8ArrayFromHexString(ephemeralKeyPair.privateKey),
    targetPublicKeyUncompressed,
  );

  // generate a nonce
  const nonce = new Uint8Array(12);
  crypto.getRandomValues(nonce);

  // create the additional data in the form of sender_public||sender_public_len||receiver_public||receiver_public_len taken from QOS here: https://github.com/tkhq/qos/blob/ae01904c756107f850aea42000137ef124df3fe4/src/qos_p256/src/encrypt.rs#L298
  const aad = createAdditionalAssociatedData(
    uint8ArrayFromHexString(ephemeralSenderPublic),
    targetPublicKeyUncompressed,
  );

  // algorithm specifications for AEX-GCM
  const alg: AesGcmParams = {
    name: "AES-GCM",
    iv: nonce,
    tagLength: 128,
    additionalData: aad,
  };

  // encrypt the message with the shared secret
  const encryptedMessageBuf = await crypto.subtle.encrypt(alg, cipher, message);

  // create the envelope
  let envelope: Envelope = {
    nonce: nonce,
    ephemeralSenderPublic: uint8ArrayFromHexString(ephemeralSenderPublic),
    encryptedMessage: new Uint8Array(encryptedMessageBuf),
  };

  // borsh serialize the envelope
  return borsh.serialize(EnvelopeSchema, envelope);
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
    uncompressRawPublicKey(compressedSenderBuf),
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
      false,
    );
    const aad = buildAdditionalAssociatedData(encappedKeyBuf, receiverPubBuf); // Eventually we want users to be able to pass in aad as optional

    // Step 1: Generate Shared Secret
    const ss = deriveSS(encappedKeyBuf, receiverPriv);

    // Step 2: Generate the KEM context
    const kemContext = getKemContext(
      encappedKeyBuf,
      uint8ArrayToHexString(receiverPubBuf),
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
 * Generate a P-256 key pair. Contains the hexed privateKey, publicKey, and Uncompressed publicKey
 *
 * @returns {KeyPair} - The generated key pair.
 */
export const generateP256KeyPair = (): KeyPair => {
  const privateKey = randomBytes(32);
  const publicKey = getPublicKey(privateKey, true);
  const publicKeyUncompressed = uint8ArrayToHexString(
    uncompressRawPublicKey(publicKey),
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
  receiverPubBuf: Uint8Array,
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
  privateKey: Uint8Array,
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
  rawPublicKey: Uint8Array,
): Uint8Array => {
  if (rawPublicKey.length !== 33) {
    throw new Error("failed to uncompress raw public key: invalid length");
  }

  if (!(rawPublicKey[0] === 2 || rawPublicKey[0] === 3)) {
    throw new Error("failed to uncompress raw public key: invalid prefix");
  }

  // point[0] must be 2 (false) or 3 (true).
  // this maps to the initial "02" or "03" prefix
  const lsb = rawPublicKey[0] === 3;
  const x = BigInt("0x" + uint8ArrayToHexString(rawPublicKey.subarray(1)));

  // https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf (Appendix D).
  const p = BigInt(
    "115792089210356248762697446949407573530086143415290314195533631308867097853951",
  );
  const b = BigInt(
    "0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b ",
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
  suiteId: Uint8Array,
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
  len: number,
): Uint8Array => {
  const suiteIdStartIndex = 9; // first two are reserved for length bytes (unused in this case), the next 7 are for the HPKE_VERSION, then the suiteId starts at 9
  const ret = new Uint8Array(
    suiteIdStartIndex + suiteId.byteLength + label.byteLength + info.byteLength,
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
  len: number,
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
    encappedKeyBuf,
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
  aad?: Uint8Array,
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
  aad?: Uint8Array,
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
  publicKey: string,
): Uint8Array => {
  const encappedKeyArray = new Uint8Array(encappedKeyBuf);
  const publicKeyArray = uint8ArrayFromHexString(publicKey);

  const kemContext = new Uint8Array(
    encappedKeyArray.length + publicKeyArray.length,
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
      `number cannot fit in a hex string of ${length} characters`,
    );
  }
  return hexString.padStart(length, "0");
};

/**
 * Converts an ASN.1 DER-encoded ECDSA signature to the raw format used for verification.
 *
 * @param {string} derSignature - The DER-encoded signature.
 * @returns {Uint8Array} - The raw signature.
 */
export const fromDerSignature = (derSignature: string): Uint8Array => {
  const derSignatureBuf = uint8ArrayFromHexString(derSignature);

  // Check minimum length
  if (derSignatureBuf.length < 2) {
    throw new Error(
      "failed to convert DER-encoded signature: insufficient length",
    );
  }

  // Check SEQUENCE tag (0x30 at first byte)
  if (derSignatureBuf[0] !== 0x30) {
    throw new Error(
      "failed to convert DER-encoded signature: invalid format (missing SEQUENCE tag)",
    );
  }

  // Check second byte, start of length field
  let index = 1;
  const lengthByte = derSignatureBuf[index]!;
  if (lengthByte <= 0x7f) {
    // Short form: single byte length

    // directly take the consumed value as length and check against buffer
    // buffer length: initial header bytes + claimed remaining length
    if (derSignatureBuf.length < 1 + 1 + lengthByte) {
      throw new Error(
        "failed to convert DER-encoded signature: inconsistent message length header",
      );
    }

    // continue parsing
    index += 1;
  } else {
    // Multi-byte DER length header
    // Invalid DER values: lengthByte 0x80 and 0xff
    // Valid DER values: lengthByte > 0x80, < 0xff
    //
    // We do not expect signature data in the Long form notation
    // -> reject all such inputs
    //
    // More complex parsing for longer signature sequences can be implemented once needed
    throw new Error(
      "failed to convert DER-encoded signature: unexpectedly large or invalid signature length",
    );
  }

  // Parse 'r' and check for integer tag (0x02)
  if (derSignatureBuf[index] !== 0x02) {
    throw new Error(
      "failed to convert DER-encoded signature: invalid tag for r",
    );
  }

  index++; // Move past the INTEGER tag
  const rLength = derSignatureBuf[index]!;

  // Allow up to 32 data bytes + 1 byte 0-padding prefix
  if (rLength > 33) {
    throw new Error(
      "failed to convert DER-encoded signature: unexpected length for r",
    );
  }

  index++; // Move past the length byte
  const r = derSignatureBuf.slice(index, index + rLength);
  index += rLength; // Move to the start of s

  // Parse 's' and check for integer tag (0x02)
  if (derSignatureBuf[index] !== 0x02) {
    throw new Error(
      "failed to convert DER-encoded signature: invalid tag for s",
    );
  }

  index++; // Move past the INTEGER tag
  const sLength = derSignatureBuf[index]!;

  // Allow up to 32 data bytes + 1 byte 0-padding prefix
  if (sLength > 33) {
    throw new Error(
      "failed to convert DER-encoded signature: unexpected length for s",
    );
  }

  index++; // Move past the length byte
  const s = derSignatureBuf.slice(index, index + sLength);

  // Normalize 'r' and 's' to 32 bytes each
  const rPadded = normalizePadding(r, 32);
  const sPadded = normalizePadding(s, 32);

  // Concatenate and return the raw signature
  return new Uint8Array([...rPadded, ...sPadded]);
};

/**
 * Converts a raw ECDSA signature to DER-encoded format.
 *
 * This function takes a raw ECDSA signature, which is a concatenation of two 32-byte integers (r and s),
 * and converts it into the DER-encoded format. DER (Distinguished Encoding Rules) is a binary encoding
 * for data structures described by ASN.1.
 *
 * @param {string} rawSignature - The raw signature in hexadecimal string format.
 * @returns {string} - The DER-encoded signature in hexadecimal string format.
 *
 * @throws {Error} - Throws an error if the input signature is invalid or if the encoding process fails.
 *
 * @example
 * // Example usage:
 * const rawSignature = "0x487cdb8a88f2f4044b701cbb116075c4cabe5fe4657a6358b395c0aab70694db3453a8057e442bd1aff0ecabe8a82c831f0edd7f2158b7c1feb3de9b1f20309b1c";
 * const derSignature = toDerSignature(rawSignature);
 * console.log(derSignature); // Outputs the DER-encoded signature as a hex string
 * // "30440220487cdb8a88f2f4044b701cbb116075c4cabe5fe4657a6358b395c0aab70694db02203453a8057e442bd1aff0ecabe8a82c831f0edd7f2158b7c1feb3de9b1f20309b"
 */
export const toDerSignature = (rawSignature: string) => {
  const rawSignatureBuf = uint8ArrayFromHexString(rawSignature);

  // Split raw signature into r and s, each 32 bytes
  const r = rawSignatureBuf.slice(0, 32);
  const s = rawSignatureBuf.slice(32, 64);

  // Helper function to encode an integer with DER structure
  const encodeDerInteger = (integer?: Uint8Array): Uint8Array => {
    // Check if integer is defined and has at least one byte
    if (
      integer === undefined ||
      integer.length === 0 ||
      integer[0] === undefined
    ) {
      throw new Error("Invalid integer: input is undefined or empty.");
    }

    // Add a leading zero if the integer's most significant byte is >= 0x80
    const needsPadding = integer[0] & 0x80;
    const paddedInteger = needsPadding
      ? new Uint8Array([0x00, ...integer])
      : integer;

    // Prepend the integer tag (0x02) and length
    return new Uint8Array([0x02, paddedInteger.length, ...paddedInteger]);
  };

  // DER encode r and s
  const rEncoded = encodeDerInteger(r);
  const sEncoded = encodeDerInteger(s);

  // Combine as a DER sequence: 0x30, total length, rEncoded, sEncoded
  const derSignature = new Uint8Array([
    0x30,
    rEncoded.length + sEncoded.length,
    ...rEncoded,
    ...sEncoded,
  ]);

  return uint8ArrayToHexString(derSignature);
};

/**
 * Create a shared AES-GCM secret with the quorum key encryption SHA-512 HMAC
 *
 * This function takes an ephemeral Sender public key generated for each encryption operation
 * the corresponding ephemeral private key, and the target public key uncompressed
 * for data structures described by ASN.1.
 *
 * @param {Uint8Array} ephemeralSenderPublic - The ephemeral public key used to create the preImage
 * @param {Uint8Array} ephemeralSenderPrivate - The ephemeral private key to create the shared secret with
 * @param {Uint8Array} targetPublicKeyUncompressed - The public key to create the shared secret with and encrypt the message to
 * @returns {Promise<CryptoKey>} - A shared secret AES-GCM key between ephemeralSenderPrivate and the targetPublicKeyUncompressed
 */
async function createQuorumKeyEncryptCipher(
  ephemeralSenderPublic: Uint8Array,
  ephemeralSenderPrivate: Uint8Array,
  targetPublicKeyUncompressed: Uint8Array,
): Promise<CryptoKey> {
  // create the shared secret between ephemeralSenderPrivate and targetPublicKeyUncompressed
  const sharedSecretUncompressed = p256.getSharedSecret(
    ephemeralSenderPrivate,
    targetPublicKeyUncompressed,
    false,
  );
  const sharedSecret = sharedSecretUncompressed.slice(1, 33);

  // create the preImage as defined in qos here: https://github.com/tkhq/qos/blob/ae01904c756107f850aea42000137ef124df3fe4/src/qos_p256/src/encrypt.rs#L273-L282
  let preImage = new Uint8Array(
    ephemeralSenderPublic.length +
      targetPublicKeyUncompressed.length +
      sharedSecret.length,
  );
  preImage.set(ephemeralSenderPublic, 0);
  preImage.set(targetPublicKeyUncompressed, ephemeralSenderPublic.length);
  preImage.set(
    sharedSecret,
    ephemeralSenderPublic.length + targetPublicKeyUncompressed.length,
  );

  // create the HMAC key and create an HMAC using QOS_ENCRYPTION_HMAC_MESSAGE
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    preImage,
    {
      name: "HMAC",
      hash: "SHA-512",
    },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", hmacKey, QOS_ENCRYPTION_HMAC_MESSAGE),
  );

  // Use the first 32 bytes as the AES-GCM key
  const aesKeyRaw = mac.slice(0, 32);

  return crypto.subtle.importKey(
    "raw",
    aesKeyRaw,
    {
      name: "AES-GCM",
    },
    false,
    ["encrypt"],
  );
}

/// Helper function to create the additional associated data (AAD). The data is
/// of the form `sender_public||sender_public_len||receiver_public||receiver_public_len`.
/// This is taken from QOS here: https://github.com/tkhq/qos/blob/ae01904c756107f850aea42000137ef124df3fe4/src/qos_p256/src/encrypt.rs#L298
///
/// Note that we append the length to each field as per NIST specs here: <https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf/>. See section 5.8.2.
function createAdditionalAssociatedData(
  ephemeralSenderPublic: Uint8Array,
  receiverPublic: Uint8Array,
): Uint8Array {
  // get the length of the sending and receiver public keys
  const ephemeralSenderLength = ephemeralSenderPublic.length;
  const receiverPublicLength = receiverPublic.length;

  // ensure the lengths are under 1 byte
  if (ephemeralSenderLength > 255 || receiverPublicLength > 255)
    throw new Error("AAD len fields are 1 byte");

  // allocate an array the size of both keys + 1 byte for their length
  const aad = new Uint8Array(
    ephemeralSenderLength + 1 + receiverPublicLength + 1,
  );

  // keep track of the offset within the array
  let offset = 0;

  // set the bytes that represent the sender public key + its length
  aad.set(ephemeralSenderPublic, offset);
  offset += ephemeralSenderLength;
  aad[offset++] = ephemeralSenderLength;

  // set the bytes that represent the receiver public key + its length
  aad.set(receiverPublic, offset);
  offset += receiverPublicLength;
  aad[offset++] = receiverPublicLength;

  return aad;
}
