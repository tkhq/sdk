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

  const jwk = pointDecode(uint8ArrayFromHexString(compressedPublicKeyHex));

  // Ensure that d is sufficiently padded
  jwk.d = hexStringToBase64url(
    uncompressedPrivateKeyHex,
    DEFAULT_JWK_MEMBER_BYTE_LENGTH
  );

  return jwk;
}
