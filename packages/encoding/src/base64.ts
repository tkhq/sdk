/**
 * Code modified from https://github.com/github/webauthn-json/blob/e932b3585fa70b0bd5b5a4012ba7dbad7b0a0d0f/src/webauthn-json/base64url.ts#L23
 */

import { uint8ArrayFromHexString } from "./hex";

/**
 * Converts a plain string into a base64url-encoded string.
 *
 * @param {string} input - The input string to encode.
 * @returns {string} - The base64url-encoded string.
 */
export function stringToBase64urlString(input: string): string {
  // string to base64
  // we do not rely on the browser's btoa since it's not present in React Native environments
  const base64String = btoa(input);
  return base64StringToBase64UrlEncodedString(base64String);
}

/**
 * Converts a hex string into a base64url-encoded string.
 *
 * @param {string} input - The input hex string.
 * @param {number} [length] - Optional length for the resulting buffer. Pads with leading 0s if needed.
 * @returns {string} - The base64url-encoded representation of the hex string.
 * @throws {Error} - If the hex string is invalid or too long for the specified length.
 */
export function hexStringToBase64url(input: string, length?: number): string {
  // Add an extra 0 to the start of the string to get a valid hex string (even length)
  // (e.g. 0x0123 instead of 0x123)
  const hexString = input.padStart(Math.ceil(input.length / 2) * 2, "0");
  const buffer = uint8ArrayFromHexString(hexString, length);

  return stringToBase64urlString(
    buffer.reduce((result, x) => result + String.fromCharCode(x), ""),
  );
}

/**
 * Converts a base64 string into a base64url-encoded string.
 *
 * @param {string} input - The input base64 string.
 * @returns {string} - The base64url-encoded string.
 */
export function base64StringToBase64UrlEncodedString(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Pure JS implementation of btoa. This is adapted from the following:
// https://github.com/jsdom/abab/blob/80874ae1fe1cde2e587bb6e51b6d7c9b42ca1d34/lib/btoa.js
function btoa(s: string): string {
  if (arguments.length === 0) {
    throw new TypeError("1 argument required, but only 0 present.");
  }

  let i;
  // String conversion as required by Web IDL.
  s = `${s}`;

  // "The btoa() method must throw an "InvalidCharacterError" DOMException if
  // data contains any character whose code point is greater than U+00FF."
  for (i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 255) {
      throw new Error(
        `InvalidCharacterError: found code point greater than 255:${s.charCodeAt(
          i,
        )} at position ${i}`,
      );
    }
  }

  let out = "";
  for (i = 0; i < s.length; i += 3) {
    const groupsOfSix: (number | undefined)[] = [
      undefined,
      undefined,
      undefined,
      undefined,
    ];
    groupsOfSix[0] = s.charCodeAt(i) >> 2;
    groupsOfSix[1] = (s.charCodeAt(i) & 0x03) << 4;
    if (s.length > i + 1) {
      groupsOfSix[1] |= s.charCodeAt(i + 1) >> 4;
      groupsOfSix[2] = (s.charCodeAt(i + 1) & 0x0f) << 2;
    }
    if (s.length > i + 2) {
      groupsOfSix[2]! |= s.charCodeAt(i + 2) >> 6;
      groupsOfSix[3] = s.charCodeAt(i + 2) & 0x3f;
    }
    for (let j = 0; j < groupsOfSix.length; j++) {
      if (typeof groupsOfSix[j] === "undefined") {
        out += "=";
      } else {
        out += btoaLookup(groupsOfSix[j]!);
      }
    }
  }
  return out;
}

function btoaLookup(index: number) {
  /**
   * Lookup table for btoa(), which converts a six-bit number into the
   * corresponding ASCII character.
   */
  const keystr =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  if (index >= 0 && index < 64) {
    return keystr[index];
  }

  // Throw INVALID_CHARACTER_ERR exception here -- won't be hit in the tests.
  return undefined;
}
