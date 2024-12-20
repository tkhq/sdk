import { pointDecode } from "./tink/elliptic_curves";
import {
  hexStringToBase64url,
  uint8ArrayFromHexString,
  DEFAULT_JWK_MEMBER_BYTE_LENGTH,
} from "@turnkey/encoding";

export function convertTurnkeyApiKeyToJwk(input: {
  uncompressedPrivateKeyHex: string;
  compressedPublicKeyHex: string;
}): JsonWebKey {
  const { uncompressedPrivateKeyHex, compressedPublicKeyHex } = input;

  let jwk;
  try {
    jwk = pointDecode(uint8ArrayFromHexString(compressedPublicKeyHex));
  } catch (e) {
    throw new Error(`invalid API key: Ensure that you are using a valid public and private key in compressed or uncompressed format and they are not switched`); 
  }

  // Ensure that d is sufficiently padded
  jwk.d = hexStringToBase64url(
    uncompressedPrivateKeyHex,
    DEFAULT_JWK_MEMBER_BYTE_LENGTH
  );

  return jwk;
}
