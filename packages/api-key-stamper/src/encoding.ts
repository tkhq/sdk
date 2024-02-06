import { pointDecode } from "./tink/elliptic_curves";

/**
 * Code modified from https://github.com/github/webauthn-json/blob/e932b3585fa70b0bd5b5a4012ba7dbad7b0a0d0f/src/webauthn-json/base64url.ts#L23
 */
export function stringToBase64urlString(input: string): string {
  // string to base64 -- we do not rely on the browser's btoa since it's not present in React Native environments
  const base64String = btoa(input);

  return base64StringToBase64UrlEncodedString(base64String);
}

export function base64StringToBase64UrlEncodedString(input: string): string {
  return input.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function uint8ArrayToHexString(input: Uint8Array): string {
  return input.reduce(
    (result, x) => result + x.toString(16).padStart(2, "0"),
    ""
  );
}

export function convertTurnkeyApiKeyToJwk(input: {
  uncompressedPrivateKeyHex: string;
  compressedPublicKeyHex: string;
}): JsonWebKey {
  const { uncompressedPrivateKeyHex, compressedPublicKeyHex } = input;

  const jwk = pointDecode(hexStringToUint8Array(compressedPublicKeyHex));

  jwk.d = hexStringToBase64urlString(uncompressedPrivateKeyHex);

  return jwk;
}

function hexStringToUint8Array(input: string): Uint8Array {
  if (
    input.length === 0 ||
    input.length % 2 !== 0 ||
    /[^a-fA-F0-9]/u.test(input)
  ) {
    throw new Error(`Invalid hex string: ${JSON.stringify(input)}`);
  }

  return Uint8Array.from(
    input
      .match(
        /.{2}/g // Split string by every two characters
      )!
      .map((byte) => parseInt(byte, 16))
  );
}

function hexStringToBase64urlString(input: string): string {
  const buffer = hexStringToUint8Array(input);

  return stringToBase64urlString(
    buffer.reduce((result, x) => result + String.fromCharCode(x), "")
  );
}

// Polyfill btoa with a pure JS implementation. This is adapted from the following:
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
          i
        )} at position ${i}`
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
