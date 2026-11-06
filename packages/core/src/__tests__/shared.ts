import {
  NIL_SESSION_PROFILE_SCOPE,
  VERIFICATION_TOKEN_TYPE_V1,
  publicKeyNonce,
  uncompressRawPublicKey,
} from "@turnkey/crypto";
import {
  hexStringToBase64url,
  uint8ArrayFromHexString,
  uint8ArrayToHexString,
} from "@turnkey/encoding";

export function p256JwkFromCompressedHex(compressedHex: string) {
  const uncompressed = uncompressRawPublicKey(
    uint8ArrayFromHexString(compressedHex),
  );
  return {
    kty: "EC",
    crv: "P-256",
    x: hexStringToBase64url(uint8ArrayToHexString(uncompressed.slice(1, 33))),
    y: hexStringToBase64url(uint8ArrayToHexString(uncompressed.slice(33, 65))),
  };
}

export function encodeVerificationToken(
  payload: Record<string, unknown>,
): string {
  const headerB64 = Buffer.from(
    JSON.stringify({
      alg: "ES256",
      typ: VERIFICATION_TOKEN_TYPE_V1,
      kid: "test-kid",
    }),
  ).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signatureB64 = Buffer.alloc(64).toString("base64url");
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export function encodeTestVerificationToken(
  publicKey: string,
  claims: Record<string, unknown>,
): string {
  return encodeVerificationToken({
    jti: "11111111-1111-4111-8111-111111111111",
    iss: "https://id.turnkey.com/t/parent-org",
    aud: "urn:turnkey:org:parent-org",
    cnf: { jwk: p256JwkFromCompressedHex(publicKey) },
    nonce: publicKeyNonce(publicKey),
    scope: NIL_SESSION_PROFILE_SCOPE,
    iat: "0",
    exp: "9999999999",
    ...claims,
  });
}
