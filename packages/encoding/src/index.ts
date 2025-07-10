/**
 * Code modified from https://github.com/github/webauthn-json/blob/e932b3585fa70b0bd5b5a4012ba7dbad7b0a0d0f/src/webauthn-json/base64url.ts#L23
 */
export const DEFAULT_JWK_MEMBER_BYTE_LENGTH = 32;

export function pointEncode(raw: Uint8Array): Uint8Array {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error("Invalid uncompressed P-256 key");
  }

  const x = raw.slice(1, 33);
  const y = raw.slice(33, 65);

  if (x.length !== 32 || y.length !== 32) {
    throw new Error("Invalid x or y length");
  }

  const prefix = (y[31]! & 1) === 0 ? 0x02 : 0x03;

  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}

export function stringToBase64urlString(input: string): string {
  // string to base64 -- we do not rely on the browser's btoa since it's not present in React Native environments
  const base64String = btoa(input);
  return base64StringToBase64UrlEncodedString(base64String);
}

export function base64UrlToBase64(input: string): string {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (b64.length % 4)) % 4;
  return b64 + "=".repeat(padLen);
}

export function decodeBase64urlToString(input: string): string {
  const b64 = base64UrlToBase64(input);
  return atob(b64);
}

export function hexStringToBase64url(input: string, length?: number): string {
  // Add an extra 0 to the start of the string to get a valid hex string (even length)
  // (e.g. 0x0123 instead of 0x123)
  const hexString = input.padStart(Math.ceil(input.length / 2) * 2, "0");
  const buffer = uint8ArrayFromHexString(hexString, length);

  return stringToBase64urlString(
    buffer.reduce((result, x) => result + String.fromCharCode(x), ""),
  );
}

export function base64StringToBase64UrlEncodedString(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function uint8ArrayToHexString(input: Uint8Array): string {
  return input.reduce(
    (result, x) => result + x.toString(16).padStart(2, "0"),
    "",
  );
}

export const uint8ArrayFromHexString = (
  hexString: string,
  length?: number,
): Uint8Array => {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  if (!hexString || hexString.length % 2 != 0 || !hexRegex.test(hexString)) {
    throw new Error(
      `cannot create uint8array from invalid hex string: "${hexString}"`,
    );
  }

  const buffer = new Uint8Array(
    hexString!.match(/../g)!.map((h: string) => parseInt(h, 16)),
  );

  if (!length) {
    return buffer;
  }
  if (hexString.length / 2 > length) {
    throw new Error(
      "hex value cannot fit in a buffer of " + length + " byte(s)",
    );
  }

  // If a length is specified, ensure we sufficiently pad
  let paddedBuffer = new Uint8Array(length);
  paddedBuffer.set(buffer, length - buffer.length);
  return paddedBuffer;
};

/**
 * Converts a hex string to an ASCII string.
 * @param {string} hexString - The input hex string to convert.
 * @returns {string} - The converted ASCII string.
 */
export function hexToAscii(hexString: string): string {
  let asciiStr = "";
  for (let i = 0; i < hexString.length; i += 2) {
    asciiStr += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));
  }
  return asciiStr;
}

/**
 * Function to normalize padding of byte array with 0's to a target length.
 *
 * @param {Uint8Array} byteArray - The byte array to pad or trim.
 * @param {number} targetLength - The target length after padding or trimming.
 * @returns {Uint8Array} - The normalized byte array.
 */
export const normalizePadding = (
  byteArray: Uint8Array,
  targetLength: number,
): Uint8Array => {
  const paddingLength = targetLength - byteArray.length;

  // Add leading 0's to array
  if (paddingLength > 0) {
    const padding = new Uint8Array(paddingLength).fill(0);
    return new Uint8Array([...padding, ...byteArray]);
  }

  // Remove leading 0's from array
  if (paddingLength < 0) {
    const expectedZeroCount = paddingLength * -1;
    let zeroCount = 0;
    for (let i = 0; i < expectedZeroCount && i < byteArray.length; i++) {
      if (byteArray[i] === 0) {
        zeroCount++;
      }
    }
    // Check if the number of zeros found equals the number of zeroes expected
    if (zeroCount !== expectedZeroCount) {
      throw new Error(
        `invalid number of starting zeroes. Expected number of zeroes: ${expectedZeroCount}. Found: ${zeroCount}.`,
      );
    }
    return byteArray.slice(expectedZeroCount, expectedZeroCount + targetLength);
  }
  return byteArray;
};

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

// Pure JS implementation of atob.
export function atob(input: string): string {
  if (arguments.length === 0) {
    throw new TypeError("1 argument required, but only 0 present.");
  }

  // convert to string and remove invalid characters upfront
  const str = String(input).replace(/[^A-Za-z0-9+/=]/g, "");

  // "The btoa() method must throw an "InvalidCharacterError" if
  // the length of the string is not a multiple of 4
  if (str.length % 4 === 1) {
    throw new Error(
      "InvalidCharacterError: The string to be decoded is not correctly encoded.",
    );
  }

  const keyStr =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let buffer = 0;
  let bits = 0;
  let i = 0;

  // process each character
  while (i < str.length) {
    const ch = str.charAt(i);
    const index = keyStr.indexOf(ch);

    if (index < 0 || index > 64) {
      i++;
      continue;
    }

    if (ch === "=") {
      // we skip padding characters
      bits = 0;
    } else {
      buffer = (buffer << 6) | index;
      bits += 6;
    }

    // output complete bytes
    while (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }

    i++;
  }

  return output;
}
