import * as crypto from "crypto";
import { convertTurnkeyApiKeyToJwk } from "./utils";

function normalizeDerSignature(signature: Buffer): Buffer {
  // minimum valid ECDSA P-256 DER signature length
  const MIN_DER_LENGTH = 8;

  // we check basic DER structure
  if (signature.length < MIN_DER_LENGTH || signature[0] !== 0x30) {
    // not DER so we don't modify
    return signature;
  }

  const declaredLength = signature[1];

  // if we can't determine length, don't modify
  if (declaredLength === undefined) {
    return signature;
  }

  const expectedLength = 2 + declaredLength;

  // we only trim if:
  // 1. buffer is longer than DER declared length
  // 2. the extra bytes are all zeros
  if (signature.length > expectedLength) {
    const paddingStart = expectedLength;
    const paddingEnd = signature.length;

    // verify all extra bytes are zero
    let isZeroPadding = true;
    for (let i = paddingStart; i < paddingEnd; i++) {
      if (signature[i] !== 0) {
        isZeroPadding = false;
        break;
      }
    }

    if (isZeroPadding) {
      return signature.subarray(0, expectedLength);
    }
  }

  return signature;
}

export const signWithApiKey = async (input: {
  content: string;
  publicKey: string;
  privateKey: string;
}): Promise<string> => {
  const { content, publicKey, privateKey } = input;

  const privateKeyObject = crypto.createPrivateKey({
    // @ts-expect-error -- the key can be a JWK object since Node v15.12.0
    // https://nodejs.org/api/crypto.html#cryptocreateprivatekeykey
    key: convertTurnkeyApiKeyToJwk({
      uncompressedPrivateKeyHex: privateKey,
      compressedPublicKeyHex: publicKey,
    }),
    format: "jwk",
  });

  const sign = crypto.createSign("SHA256");
  sign.write(Buffer.from(content));
  sign.end();

  const signatureBuffer = sign.sign(privateKeyObject);

  // we normalize the signature
  // this is needed to fix the polyfill bug in Cloudflare Workers
  // where ECDSA signatures are zero-padded to 72 bytes,
  const normalizedBuffer = normalizeDerSignature(signatureBuffer);

  return normalizedBuffer.toString("hex");
};
