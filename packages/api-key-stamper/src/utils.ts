import { pointDecode } from "./tink/elliptic_curves";
import { stringToBase64urlString } from "@turnkey/encoding";

export function convertTurnkeyApiKeyToJwk(input: {
  uncompressedPrivateKeyHex: string;
  compressedPublicKeyHex: string;
}): JsonWebKey {
  const { uncompressedPrivateKeyHex, compressedPublicKeyHex } = input;

  const jwk = pointDecode(hexStringToUint8Array(compressedPublicKeyHex));

  jwk.d = hexStringToBase64urlString(uncompressedPrivateKeyHex);

  return jwk;
}

function hexStringToUint8Array(input: string): Uint8Array {
  if (
    input.length === 0 ||
    input.length % 2 !== 0 ||
    /[^a-fA-F0-9]/u.test(input)
  ) {
    throw new Error(`Invalid hex string: ${JSON.stringify(input)}`);
  }

  return Uint8Array.from(
    input
      .match(
        /.{2}/g // Split string by every two characters
      )!
      .map((byte) => parseInt(byte, 16))
  );
}

function hexStringToBase64urlString(input: string): string {
  const buffer = hexStringToUint8Array(input);

  return stringToBase64urlString(
    buffer.reduce((result, x) => result + String.fromCharCode(x), "")
  );
}
