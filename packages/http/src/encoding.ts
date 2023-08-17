/**
 * Code modified from https://github.com/github/webauthn-json/blob/e932b3585fa70b0bd5b5a4012ba7dbad7b0a0d0f/src/webauthn-json/base64url.ts#L23
 */
export function stringToBase64urlString(input: string): string {
  // string to base64
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
