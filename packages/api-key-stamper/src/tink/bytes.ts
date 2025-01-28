/**
 * Code modified from https://github.com/google/tink/blob/6f74b99a2bfe6677e3670799116a57268fd067fa/javascript/subtle/bytes.ts
 *
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts the hex string to a byte array.
 *
 * @param hex the input
 * @return the byte array output
 * @throws {!Error}
 * @static
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 != 0) {
    throw new Error("Hex string length must be multiple of 2");
  }
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return arr;
}

/**
 * Converts a byte array to hex.
 *
 * @param bytes the byte array input
 * @return hex the output
 * @static
 */
export function toHex(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    const hexByte = bytes[i]!.toString(16);
    result += hexByte.length > 1 ? hexByte : "0" + hexByte;
  }
  return result;
}

/**
 * Base64 encode a byte array.
 *
 * @param bytes the byte array input
 * @param opt_webSafe True indicates we should use the alternative
 *     alphabet, which does not require escaping for use in URLs.
 * @return base64 output
 * @static
 */
export function toBase64(bytes: Uint8Array, opt_webSafe?: boolean): string {
  const encoded = btoa(
    /* padding */
    toByteString(bytes)
  ).replace(/=/g, "");
  if (opt_webSafe) {
    return encoded.replace(/\+/g, "-").replace(/\//g, "_");
  }
  return encoded;
}

/**
 * Turns a byte array into the string given by the concatenation of the
 * characters to which the numbers correspond. Each byte is corresponding to a
 * character. Does not support multi-byte characters.
 *
 * @param bytes Array of numbers representing
 *     characters.
 * @return Stringification of the array.
 */
export function toByteString(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i += 1) {
    str += String.fromCharCode(bytes[i]!);
  }
  return str;
}
