/// <reference lib="dom" />
// Turnkey-specific cryptographic utilities
import bs58check from "bs58check";
import bs58 from "bs58";

import {
  uint8ArrayToHexString,
  uint8ArrayFromHexString,
  hexToAscii,
} from "@turnkey/encoding";

import { PRODUCTION_SIGNER_PUBLIC_KEY } from "./constants";
import {
  formatHpkeBuf,
  fromDerSignature,
  hpkeDecrypt,
  hpkeEncrypt,
  uncompressRawPublicKey,
} from "./crypto";

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

/**
 * Decrypt an encrypted email auth/recovery or oauth credential bundle.
 *
 * @param {string} credentialBundle - The encrypted credential bundle.
 * @param {string} embeddedKey - The private key for decryption.
 * @returns {string} - The decrypted data or null if decryption fails.
 * @throws {Error} - If unable to decrypt the credential bundle
 */
export const decryptCredentialBundle = (
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
}: DecryptExportBundleParams): Promise<string> => {
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
 * Verifies a signature from a Turnkey stamp using ECDSA and SHA-256.
 *
 * @param {string} publicKey - The public key of the authenticator (e.g. WebAuthn or P256 API key).
 * @param {string} signature - The ECDSA signature in DER format.
 * @param {string} signedData - The data that was signed (e.g. JSON-stringified Turnkey request body).
 * @returns {Promise<boolean>} - Returns true if the signature is valid, otherwise throws an error.
 *
 * @example
 *
 * const stampedRequest = await turnkeyClient.stampGetWhoami(...);
 * const decodedStampContents = atob(stampedRequest.stamp.stampHeaderValue);
 * const parsedStampContents = JSON.parse(decodedStampContents);
 * const signature = parsedStampContents.signature;
 *
 * await verifyStampSignature(publicKey, signature, stampedRequest.body)
 */
export const verifyStampSignature = async (
  publicKey: string,
  signature: string,
  signedData: string
): Promise<boolean> => {
  const publicKeyBuffer = uint8ArrayFromHexString(publicKey);
  const loadedPublicKey = await loadPublicKey(publicKeyBuffer);
  if (!loadedPublicKey) {
    throw new Error("failed to load public key");
  }

  // The ECDSA signature is ASN.1 DER encoded but WebCrypto uses raw format
  const publicSignatureBuf = fromDerSignature(signature);
  const signedDataBuf = Buffer.from(signedData);
  return await crypto.subtle.verify(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    loadedPublicKey,
    publicSignatureBuf,
    signedDataBuf
  );
};

/**
 * Verifies a signature from a Turnkey enclave using ECDSA and SHA-256.
 *
 * @param {string} enclaveQuorumPublic - The public key of the enclave signer.
 * @param {string} publicSignature - The ECDSA signature in DER format.
 * @param {string} signedData - The data that was signed.
 * @param {Environment} dangerouslyOverrideSignerPublicKey - (optional) an enum (PROD or PREPROD) to verify against the correct signer enclave key.
 * @returns {Promise<boolean>} - Returns true if the signature is valid, otherwise throws an error.
 */
const verifyEnclaveSignature = async (
  enclaveQuorumPublic: string,
  publicSignature: string,
  signedData: string,
  dangerouslyOverrideSignerPublicKey?: string
): Promise<boolean> => {
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
  const quorumKey = await loadPublicKey(encryptionQuorumPublicBuf);
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
 * Loads an ECDSA public key from a raw format for signature verification.
 *
 * @param {Uint8Array} publicKey - The raw public key bytes.
 * @returns {Promise<CryptoKey>} - The imported ECDSA public key.
 */
const loadPublicKey = async (publicKey: Uint8Array): Promise<CryptoKey> => {
  return await crypto.subtle.importKey(
    "raw",
    publicKey,
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
