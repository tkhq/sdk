import { pointDecode } from "./tink/elliptic_curves";
import {
  stringToBase64urlString,
  base64urlToBuffer,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

const DEFAULT_JWK_MEMBER_BYTE_LENGTH = 32;

export function convertTurnkeyApiKeyToJwk(input: {
  uncompressedPrivateKeyHex: string;
  compressedPublicKeyHex: string;
}): JsonWebKey {
  const { uncompressedPrivateKeyHex, compressedPublicKeyHex } = input;

  const jwk = pointDecode(hexStringToUint8Array(compressedPublicKeyHex));

  // First make a copy to manipulate
  const jwkCopy = { ...jwk };

  // Ensure that each of the constituent parts are sufficiently padded
  jwkCopy.d = hexStringToBase64urlString(uncompressedPrivateKeyHex);

  // Manipulate x and y
  const decodedX = base64urlToBuffer(jwkCopy.x!);
  const paddedX = hexStringToBase64urlString(
    uint8ArrayToHexString(new Uint8Array(decodedX)),
    DEFAULT_JWK_MEMBER_BYTE_LENGTH
  );

  const decodedY = base64urlToBuffer(jwkCopy.y!);
  const paddedY = hexStringToBase64urlString(
    uint8ArrayToHexString(new Uint8Array(decodedY)),
    DEFAULT_JWK_MEMBER_BYTE_LENGTH
  );

  jwkCopy.x = paddedX;
  jwkCopy.y = paddedY;

  return jwkCopy;
}

/*
 * Note: the following helpers will soon be moved to @tkhq/encoding
 */
function hexStringToUint8Array(input: string, length?: number): Uint8Array {
  if (
    input.length === 0 ||
    input.length % 2 !== 0 ||
    /[^a-fA-F0-9]/u.test(input)
  ) {
    throw new Error(`Invalid hex string: ${JSON.stringify(input)}`);
  }

  const buffer = Uint8Array.from(
    input
      .match(
        /.{2}/g // Split string by every two characters
      )!
      .map((byte) => parseInt(byte, 16))
  );

  if (!length) {
    return buffer;
  }

  // If a length is specified, ensure we sufficiently pad
  let paddedBuffer = new Uint8Array(length);
  paddedBuffer.set(buffer, length - buffer.length);
  return paddedBuffer;
}

function hexStringToBase64urlString(input: string, length?: number): string {
  // Add an extra 0 to the start of the string to get a valid hex string (even length)
  // (e.g. 0x0123 instead of 0x123)
  const hexString = input.padStart(Math.ceil(input.length / 2) * 2, "0");
  const buffer = hexStringToUint8Array(hexString, length);

  return stringToBase64urlString(
    buffer.reduce((result, x) => result + String.fromCharCode(x), "")
  );
}
