import * as crypto from "crypto";

import { base64urlDecode } from "./base64";
import { buf2hex } from "./hex";

type TKeygenResult = {
    publicKey: string;
    publicKeyUncompressed: string;
    privateKey: string;
}

export async function p256Keygen(): Promise<TKeygenResult> {
  // Create a new P-256 keypair
  const p256Keypair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  // Export the raw public key. By default this will export in uncompressed format
  const rawPublicKey = await crypto.subtle.exportKey(
    "raw",
    p256Keypair.publicKey
  );

  // We need to export with JWK format because exporting EC private keys with "raw" isn't supported
  const privateKeyJwk = await crypto.subtle.exportKey(
    "jwk",
    p256Keypair.privateKey
  );

  // Optional: compress the public key! But you don't have to
  const compressedPublicKeyBuffer = compressRawPublicKey(rawPublicKey);

  const privateKeyBuffer = base64urlDecode(privateKeyJwk.d!);
  return {
    publicKey: buf2hex(compressedPublicKeyBuffer),
    publicKeyUncompressed: buf2hex(rawPublicKey),
    privateKey: buf2hex(privateKeyBuffer),
  };
}

// Accepts a public key array buffer, and returns a buffer with the compressed version of the public key
function compressRawPublicKey(rawPublicKey: ArrayBufferLike): ArrayBufferLike {
  const rawPublicKeyBytes = new Uint8Array(rawPublicKey);
  const len = rawPublicKeyBytes.byteLength;

  // Drop the y coordinate
  let compressedBytes = rawPublicKeyBytes.slice(0, (1 + len) >>> 1);

  // Encode the parity of `y` in first bit
  compressedBytes[0] = 0x2 | (rawPublicKeyBytes[len - 1]! & 0x01);
  return compressedBytes.buffer;
}
