import { uint8ArrayFromHexString } from "@turnkey/encoding";
import {
  generateP256KeyPair,
  buildAdditionalAssociatedData,
  compressRawPublicKey,
} from "@turnkey/crypto";

import { Buffer } from "buffer";
import bs58check from "bs58check";
import { AeadId, CipherSuite, KdfId, KemId } from "hpke-js";

import type { EmbeddedAPIKey } from "./models";
import { pointDecode } from "@turnkey/api-key-stamper";

// createEmbeddedAPIKey creates an embedded API key encrypted to a target key (typically embedded within an iframe).
// This returns a bundle that can be decrypted by that target key, as well as the public key of the newly created API key.
export const createEmbeddedAPIKey = async (
  targetPublicKey: string
): Promise<EmbeddedAPIKey> => {
  const TURNKEY_HPKE_INFO = new TextEncoder().encode("turnkey_hpke");

  // 1: create new API key (to be encrypted to the targetPublicKey)
  const p256key = generateP256KeyPair();

  // 2: set up encryption
  const suite = new CipherSuite({
    kem: KemId.DhkemP256HkdfSha256,
    kdf: KdfId.HkdfSha256,
    aead: AeadId.Aes256Gcm,
  });

  // 3: import the targetPublicKey (i.e. passed in from the iframe)
  const targetKeyBytes = uint8ArrayFromHexString(targetPublicKey);
  const jwk = pointDecode(targetKeyBytes);

  const targetKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );

  // 4: sender encrypts a message to the target key
  const sender = await suite.createSenderContext({
    recipientPublicKey: targetKey,
    info: TURNKEY_HPKE_INFO,
  });
  const ciphertext = await sender.seal(
    uint8ArrayFromHexString(p256key.privateKey),
    buildAdditionalAssociatedData(new Uint8Array(sender.enc), targetKeyBytes)
  );
  const ciphertextUint8Array = new Uint8Array(ciphertext);

  // 5: assemble bundle
  const encappedKey = new Uint8Array(sender.enc);
  const compressedEncappedKey = compressRawPublicKey(encappedKey);
  const result = new Uint8Array(
    compressedEncappedKey.length + ciphertextUint8Array.length
  );
  result.set(compressedEncappedKey);
  result.set(ciphertextUint8Array, compressedEncappedKey.length);

  const base58encodedBundle = bs58check.encode(result);

  return {
    authBundle: base58encodedBundle,
    publicKey: p256key.publicKey,
  };
};

export const generateRandomBuffer = (): ArrayBuffer => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
};

export const base64UrlEncode = (challenge: ArrayBuffer): string => {
  return Buffer.from(challenge)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

const hexByByte = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, "0")
);

export const bytesToHex = (bytes: Uint8Array): string => {
  let hex = "0x";
  if (bytes === undefined || bytes.length === 0) return hex;
  for (const byte of bytes) {
    hex += hexByByte[byte];
  }
  return hex;
};
