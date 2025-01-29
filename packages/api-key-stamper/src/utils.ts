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
    throw new Error(
      `unable to load API key: invalid public key. Did you switch your public and private key?`,
    );
  }

  // Ensure that d is sufficiently padded
  jwk.d = hexStringToBase64url(
    uncompressedPrivateKeyHex,
    DEFAULT_JWK_MEMBER_BYTE_LENGTH,
  );

  return jwk;
}
