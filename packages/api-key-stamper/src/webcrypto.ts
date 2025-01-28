/// <reference lib="dom" />
import { convertTurnkeyApiKeyToJwk } from "./utils";
import { uint8ArrayToHexString } from "@turnkey/encoding";

export const signWithApiKey = async (input: {
  content: string;
  publicKey: string;
  privateKey: string;
}): Promise<string> => {
  const { content, publicKey, privateKey } = input;

  const key = await importTurnkeyApiKey({
    uncompressedPrivateKeyHex: privateKey,
    compressedPublicKeyHex: publicKey,
  });
  return await signMessage({ key, content });
};

async function importTurnkeyApiKey(input: {
  uncompressedPrivateKeyHex: string;
  compressedPublicKeyHex: string;
}): Promise<CryptoKey> {
  const { uncompressedPrivateKeyHex, compressedPublicKeyHex } = input;

  const jwk = convertTurnkeyApiKeyToJwk({
    uncompressedPrivateKeyHex,
    compressedPublicKeyHex,
  });

  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false, // not extractable
    ["sign"] // allow signing
  );
}

async function signMessage(input: {
  key: CryptoKey;
  content: string;
}): Promise<string> {
  const { key, content } = input;

  const signatureIeee1363 = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: "SHA-256",
    },
    key,
    new TextEncoder().encode(content)
  );

  const signatureDer = convertEcdsaIeee1363ToDer(
    new Uint8Array(signatureIeee1363)
  );

  return uint8ArrayToHexString(signatureDer);
}

/**
 * `SubtleCrypto.sign(...)` outputs signature in IEEE P1363 format:
 * - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign#ecdsa
 *
 * Turnkey expects the signature encoding to be DER-encoded ASN.1:
 * - https://github.com/tkhq/tkcli/blob/7f0159af5a73387ff050647180d1db4d3a3aa033/src/internal/apikey/apikey.go#L149
 *
 * Code modified from https://github.com/google/tink/blob/6f74b99a2bfe6677e3670799116a57268fd067fa/javascript/subtle/elliptic_curves.ts#L114
 *
 * Transform an ECDSA signature in IEEE 1363 encoding to DER encoding.
 *
 * @param ieee the ECDSA signature in IEEE encoding
 * @return ECDSA signature in DER encoding
 */
function convertEcdsaIeee1363ToDer(ieee: Uint8Array): Uint8Array {
  if (ieee.length % 2 != 0 || ieee.length == 0 || ieee.length > 132) {
    throw new Error(
      "Invalid IEEE P1363 signature encoding. Length: " + ieee.length
    );
  }
  const r = toUnsignedBigNum(ieee.subarray(0, ieee.length / 2));
  const s = toUnsignedBigNum(ieee.subarray(ieee.length / 2, ieee.length));
  let offset = 0;
  const length = 1 + 1 + r.length + 1 + 1 + s.length;
  let der;
  if (length >= 128) {
    der = new Uint8Array(length + 3);
    der[offset++] = 48;
    der[offset++] = 128 + 1;
    der[offset++] = length;
  } else {
    der = new Uint8Array(length + 2);
    der[offset++] = 48;
    der[offset++] = length;
  }
  der[offset++] = 2;
  der[offset++] = r.length;
  der.set(r, offset);
  offset += r.length;
  der[offset++] = 2;
  der[offset++] = s.length;
  der.set(s, offset);
  return der;
}

/**
 * Code modified from https://github.com/google/tink/blob/6f74b99a2bfe6677e3670799116a57268fd067fa/javascript/subtle/elliptic_curves.ts#L311
 *
 * Transform a big integer in big endian to minimal unsigned form which has
 * no extra zero at the beginning except when the highest bit is set.
 */
function toUnsignedBigNum(bytes: Uint8Array): Uint8Array {
  // Remove zero prefixes.
  let start = 0;
  while (start < bytes.length && bytes[start] == 0) {
    start++;
  }
  if (start == bytes.length) {
    start = bytes.length - 1;
  }
  let extraZero = 0;

  // If the 1st bit is not zero, add 1 zero byte.
  if ((bytes[start]! & 128) == 128) {
    // Add extra zero.
    extraZero = 1;
  }
  const res = new Uint8Array(bytes.length - start + extraZero);
  res.set(bytes.subarray(start), extraZero);
  return res;
}
