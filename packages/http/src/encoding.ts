/**
 * Code modified from https://github.com/github/webauthn-json/blob/e932b3585fa70b0bd5b5a4012ba7dbad7b0a0d0f/src/webauthn-json/base64url.ts#L23
 */
export function encodeToBase64url(input: string): string {
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

export function toHexString(input: Uint8Array): string {
  return input.reduce(
    (result, x) => result + x.toString(16).padStart(2, "0"),
    ""
  );
}
