import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/env";

function getKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, "hex");
  if (key.length !== 32)
    throw new Error(`ENCRYPTION_KEY must decode to 32 bytes`);
  return key;
}

// AES-256-GCM envelope: base64( iv(12B) | tag(16B) | ciphertext )
export function encryptAtRest(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptAtRest(envelopeB64: string): string {
  const key = getKey();
  const buf = Buffer.from(envelopeB64, "base64");
  if (buf.length < 29) throw new Error("encryptAtRest envelope too short");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buf.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
