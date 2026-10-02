import { describe, expect, it, jest } from "@jest/globals";
import { stringToBase64urlString } from "@turnkey/encoding";
import { buildOtpLoginRequest } from "../utils";

const verificationPublicKey = "verification-public-key";
const verificationToken = `header.${stringToBase64urlString(
  JSON.stringify({
    contact: "alice@example.com",
    exp: 1,
    id: "verification-token-id",
    public_key: verificationPublicKey,
    verification_type: "EMAIL",
    organization_id: "parent-organization-id",
  }),
)}.signature`;

describe("strict OTP login request", () => {
  it("keeps absent optional request values absent from the signed usage", async () => {
    const sign = jest.fn(async () => "compact-signature");
    const request = await buildOtpLoginRequest({
      verificationToken,
      organizationId: "sub-organization-id",
      publicKey: "session-public-key",
      sign,
    });

    expect(JSON.parse(request.clientSignature.message)).toEqual({
      loginV2: {
        organizationId: request.suborgID,
        publicKey: request.publicKey,
      },
      tokenId: "verification-token-id",
      type: "USAGE_TYPE_LOGIN",
    });
    expect(request).not.toHaveProperty("sessionLengthSeconds");
    expect(request.clientSignature.publicKey).toBe(verificationPublicKey);
    expect(sign).toHaveBeenCalledWith(request.clientSignature.message);
  });

  it("uses the same expiration in the request and signed usage", async () => {
    const request = await buildOtpLoginRequest({
      verificationToken,
      organizationId: "sub-organization-id",
      publicKey: "session-public-key",
      sessionLengthSeconds: 3600,
      sign: async () => "compact-signature",
    });

    expect(JSON.parse(request.clientSignature.message).loginV2).toEqual({
      organizationId: request.suborgID,
      publicKey: request.publicKey,
      expirationSeconds: request.sessionLengthSeconds?.toString(),
    });
  });
});
