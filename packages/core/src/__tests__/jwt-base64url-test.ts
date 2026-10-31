import { describe, expect, it } from "@jest/globals";
import { stringToBase64urlString } from "@turnkey/encoding";

import { parseSession, decodeVerificationToken } from "../utils";

/** Encode JSON as UTF-8 bytes before applying base64url, as JWTs require. */
function encodeSegment(payload: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return stringToBase64urlString(String.fromCharCode(...bytes));
}

/** Build a JWT-shaped token with UTF-8 JSON segments. */
function makeToken(payload: object): string {
  return [
    encodeSegment({ alg: "ES256", typ: "JWT" }),
    encodeSegment(payload),
    "signature",
  ].join(".");
}

describe("JWT payload decoding", () => {
  // The multibyte character also produces a URL-safe base64 character.
  const contact = "🚀user@example.com";

  it("parseSession decodes a payload containing base64url characters", () => {
    const token = makeToken({
      exp: 1893456000,
      public_key: "04aa",
      session_type: "SESSION_TYPE_READ_WRITE",
      user_id: "user-id",
      organization_id: "organization-id",
      scope: contact,
    });

    expect(token.split(".")[1]).toMatch(/[-_]/);
    expect(parseSession(token)).toMatchObject({
      organizationId: "organization-id",
      scope: contact,
    });
  });

  it("decodeVerificationToken decodes a payload containing base64url characters", () => {
    const token = makeToken({ contact, otp_id: "otp-id" });

    expect(token.split(".")[1]).toMatch(/[-_]/);
    expect(decodeVerificationToken(token)).toMatchObject({ contact });
  });
});
