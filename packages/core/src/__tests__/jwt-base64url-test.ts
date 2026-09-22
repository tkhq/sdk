import { describe, expect, it } from "@jest/globals";
import { stringToBase64urlString } from "@turnkey/encoding";

import { parseSession, decodeVerificationToken } from "../utils";

/** Build a JWT-shaped token whose payload is base64url encoded. */
function makeToken(payload: object): string {
  return [
    stringToBase64urlString(JSON.stringify({ alg: "ES256", typ: "JWT" })),
    stringToBase64urlString(JSON.stringify(payload)),
    "signature",
  ].join(".");
}

describe("JWT payload decoding", () => {
  // This contact makes the payload's base64url form contain "_", which only
  // a base64url decoder handles: standard base64 `atob` rejects or corrupts
  // it even though the token itself is perfectly valid.
  const contact = "üuser@example.com";

  it("parseSession decodes a payload containing base64url characters", () => {
    const token = makeToken({
      exp: 1893456000,
      public_key: "04aa",
      session_type: "SESSION_TYPE_READ_WRITE",
      user_id: "user-id",
      organization_id: "organization-id",
      scope: contact,
    });

    expect(parseSession(token).organizationId).toBe("organization-id");
  });

  it("decodeVerificationToken decodes a payload containing base64url characters", () => {
    const token = makeToken({ contact, otp_id: "otp-id" });

    expect(decodeVerificationToken(token)).toMatchObject({ contact });
  });
});
