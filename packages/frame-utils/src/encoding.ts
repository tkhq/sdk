// Encoding utilities

// exported
export const base64urlEncode = (data: Uint8Array): string => {
  let binary = "";
  data.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const base64urlDecode = (base64url: string): Uint8Array => {
  let binary_string = atob(base64url.replace(/\-/g, "+").replace(/_/g, "/"));
  let len = binary_string.length;
  let bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes;
};

export const base58checkDecode = (input: string): Uint8Array => {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const ALPHABET_MAP = new Map(
    [...ALPHABET].map((char, index) => [char, index])
  );

  if (input.length === 0) return new Uint8Array();

  let bytes = [0];
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (!ALPHABET_MAP.has(char!)) {
      throw new Error("Invalid character found: " + char);
    }
    const value = ALPHABET_MAP.get(char!)!;

    for (let j = 0; j < bytes.length; j++) {
      bytes[j] *= 58;
    }
    bytes[0] += value;

    let carry = 0;
    for (let j = 0; j < bytes.length; j++) {
      bytes[j] += carry;
      carry = bytes[j]! >> 8;
      bytes[j] &= 0xff;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Reverse bytes array
  bytes.reverse();

  // Remove leading zeros
  const zeroCount = input.split("").findIndex((char) => char !== "1");
  const leadingZeros = Array(zeroCount).fill(0);
  bytes = [...leadingZeros, ...bytes];

  // Verify checksum
  const payload = bytes.slice(0, -4);
  const checksum = bytes.slice(-4);
  const expectedChecksum = doubleSha256(payload).slice(0, 4);

  if (!checksum.every((byte, index) => byte === expectedChecksum[index])) {
    throw new Error("Invalid checksum");
  }

  return new Uint8Array(payload);
};

// internal
const doubleSha256 = (input: number[]): Uint8Array => {
  const crypto = require("crypto");
  const hash1 = crypto
    .createHash("sha256")
    .update(new Uint8Array(input))
    .digest();
  return crypto.createHash("sha256").update(hash1).digest();
};
