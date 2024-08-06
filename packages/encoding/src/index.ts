/**
 * Code modified from https://github.com/github/webauthn-json/blob/e932b3585fa70b0bd5b5a4012ba7dbad7b0a0d0f/src/webauthn-json/base64url.ts#L23
 */
export function stringToBase64urlString(input: string): string {
  // string to base64 -- we do not rely on the browser's btoa since it's not present in React Native environments
  const base64String = btoa(input);
  return base64StringToBase64UrlEncodedString(base64String);
}

export function base64urlToBuffer(
  baseurl64String: string
): ArrayBuffer {
  // Base64url to Base64
  const padding = "==".slice(0, (4 - (baseurl64String.length % 4)) % 4);
  const base64String =
    baseurl64String.replace(/-/g, "+").replace(/_/g, "/") + padding;

  // Base64 to binary string
  const str = atob(base64String);

  // Binary string to buffer
  const buffer = new ArrayBuffer(str.length);
  const byteView = new Uint8Array(buffer);
  for (let i = 0; i < str.length; i++) {
    byteView[i] = str.charCodeAt(i);
  }
  return buffer;
}

export function bufferToBase64url(buffer: ArrayBuffer): string {
  // Buffer to binary string
  const byteView = new Uint8Array(buffer);
  let str = "";
  for (const charCode of byteView) {
    str += String.fromCharCode(charCode);
  }

  // Binary string to base64
  const base64String = btoa(str);

  // Base64 to base64url
  // We assume that the base64url string is well-formed.
  const base64urlString = base64String
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return base64urlString;
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

export const uint8ArrayFromHexString = (hexString: string): Uint8Array => {
  const hexRegex = /^[0-9A-Fa-f]+$/;
  if (!hexString || hexString.length % 2 != 0 || !hexRegex.test(hexString)) {
    throw new Error(
      `cannot create uint8array from invalid hex string: "${hexString}"`
    );
  }
  return new Uint8Array(
    hexString!.match(/../g)!.map((h: string) => parseInt(h, 16))
  );
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
