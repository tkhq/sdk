import { Buffer } from "buffer";

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

const hexByByte = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'))

export const bytesToHex = (bytes: Uint8Array): string => {
  let hex = '0x'
  if (bytes === undefined || bytes.length === 0) return hex
  for (const byte of bytes) {
    hex += hexByByte[byte]
  }
  return hex
}
