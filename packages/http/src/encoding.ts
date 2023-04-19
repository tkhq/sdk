/**
 * Code modified from https://github.com/github/webauthn-json/blob/e932b3585fa70b0bd5b5a4012ba7dbad7b0a0d0f/src/webauthn-json/base64url.ts#L23
 */
export function stringToBase64urlString(input: string): string {
  // string to base64
  const base64String = btoa(input);

  // base64 to base64url
  // We assume that the base64url string is well-formed.
  const base64urlString = base64String
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return base64urlString;
}

export function uint8ArrayToHexString(input: Uint8Array): string {
  return input.reduce(
    (result, x) => result + x.toString(16).padStart(2, "0"),
    ""
  );
}

export function hexStringToUint8Array(input: string): Uint8Array {
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

export function hexStringToBase64urlString(input: string): string {
  const buffer = hexStringToUint8Array(input);

  return stringToBase64urlString(
    buffer.reduce((result, x) => result + String.fromCharCode(x), "")
  );
}
