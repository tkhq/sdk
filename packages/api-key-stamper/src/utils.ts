import { pointDecode } from "./tink/elliptic_curves";
import {
  hexStringToBase64url,
  uint8ArrayFromHexString,
  DEFAULT_JWK_MEMBER_BYTE_LENGTH,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

/**
 * Converts a Turnkey API key pair into a JSON Web Key (JWK) format.
 * This function accepts P-256 API keys only.
 *
 * @param {Object} input - The Turnkey API key components.
 * @param {string} input.uncompressedPrivateKeyHex - Hexadecimal-encoded uncompressed private key (32-byte scalar).
 * @param {string} input.compressedPublicKeyHex - Hexadecimal-encoded compressed public key (33 bytes).
 * @returns {JsonWebKey} A JSON Web Key object representing the EC P-256 key.
 */
export function convertTurnkeyApiKeyToJwk(input: {
  uncompressedPrivateKeyHex: string;
  compressedPublicKeyHex: string;
}): JsonWebKey {
  const { uncompressedPrivateKeyHex, compressedPublicKeyHex } = input;

  let jwk;
  try {
    jwk = pointDecode(uint8ArrayFromHexString(compressedPublicKeyHex));
  } catch (e) {
    throw new Error(
      `unable to load API key: invalid public key. Did you switch your public and private key by accident? Is your public key a valid, compressed P-256 public key?`,
    );
  }

  // Ensure that d is sufficiently padded
  jwk.d = hexStringToBase64url(
    uncompressedPrivateKeyHex,
    DEFAULT_JWK_MEMBER_BYTE_LENGTH,
  );

  return jwk;
}

export function convertDerSignatureToRawEcdsa(der: string): string {
  // Convert DER to raw format
  const derBytes = uint8ArrayFromHexString(der);

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
  return uint8ArrayToHexString(rawSignature);
}
