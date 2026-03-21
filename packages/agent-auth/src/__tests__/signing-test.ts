import { signJwt, signMessage } from "../signing";

const mockClient = {
  signRawPayload: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default: return fixed r, s, v (each 64 hex chars = 32 bytes)
  mockClient.signRawPayload.mockResolvedValue({
    r: "a".repeat(64),
    s: "b".repeat(64),
    v: "00",
  });
});

describe("signJwt", () => {
  const baseParams = {
    organizationId: "org-123",
    signingKey: "0xP256Address",
    payload: { iss: "test-issuer", sub: "test-subject", aud: "test-audience" },
  };

  it("produces a valid JWT with 3 base64url segments", async () => {
    const jwt = await signJwt(mockClient, baseParams);
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);

    // Each part should be valid base64url (no +, /, or = characters)
    for (const part of parts) {
      expect(part).not.toMatch(/[+/=]/);
    }
  });

  it("defaults header to ES256", async () => {
    const jwt = await signJwt(mockClient, baseParams);
    const headerJson = JSON.parse(
      atob(jwt.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/")),
    );
    expect(headerJson).toEqual({ alg: "ES256", typ: "JWT" });
  });

  it("passes custom header through", async () => {
    const jwt = await signJwt(mockClient, {
      ...baseParams,
      header: { alg: "ES256", typ: "JWT", kid: "my-key-id" },
    });
    const headerJson = JSON.parse(
      atob(jwt.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/")),
    );
    expect(headerJson.kid).toBe("my-key-id");
  });

  it("passes payload claims through unchanged (no auto-iat, no auto-exp)", async () => {
    const jwt = await signJwt(mockClient, baseParams);
    const payloadJson = JSON.parse(
      atob(jwt.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    );
    expect(payloadJson).toEqual({
      iss: "test-issuer",
      sub: "test-subject",
      aud: "test-audience",
    });
    // No iat or exp auto-added
    expect(payloadJson.iat).toBeUndefined();
    expect(payloadJson.exp).toBeUndefined();
  });

  it("sends HASH_FUNCTION_NO_OP with pre-hashed digest to Turnkey", async () => {
    await signJwt(mockClient, baseParams);

    expect(mockClient.signRawPayload).toHaveBeenCalledTimes(1);
    const args = mockClient.signRawPayload.mock.calls[0]![0];
    expect(args.hashFunction).toBe("HASH_FUNCTION_NO_OP");
    expect(args.encoding).toBe("PAYLOAD_ENCODING_HEXADECIMAL");
    expect(args.signWith).toBe("0xP256Address");
    expect(args.organizationId).toBe("org-123");
    // Payload should be 64 hex chars (32 bytes SHA-256 digest)
    expect(args.payload).toHaveLength(64);
  });

  it("signature is raw r||s base64url encoded (not DER)", async () => {
    const jwt = await signJwt(mockClient, baseParams);
    const sigPart = jwt.split(".")[2]!;

    // Decode base64url to bytes
    const sigBase64 = sigPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = sigBase64 + "=".repeat((4 - (sigBase64.length % 4)) % 4);
    const sigBytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));

    // ES256 raw signature is exactly 64 bytes (r: 32 + s: 32)
    expect(sigBytes.length).toBe(64);
  });

  it("throws if r or s has unexpected length", async () => {
    mockClient.signRawPayload.mockResolvedValue({
      r: "abcd", // too short
      s: "b".repeat(64),
      v: "00",
    });

    await expect(signJwt(mockClient, baseParams)).rejects.toThrow(
      "Unexpected signature component length",
    );
  });
});

describe("signMessage", () => {
  const baseParams = {
    organizationId: "org-123",
    signingKey: "0xAnyAddress",
    message: "deadbeef",
  };

  it("passes params through to signRawPayload with defaults", async () => {
    const result = await signMessage(mockClient, baseParams);

    expect(mockClient.signRawPayload).toHaveBeenCalledTimes(1);
    const args = mockClient.signRawPayload.mock.calls[0]![0];
    expect(args.organizationId).toBe("org-123");
    expect(args.signWith).toBe("0xAnyAddress");
    expect(args.payload).toBe("deadbeef");
    expect(args.encoding).toBe("PAYLOAD_ENCODING_HEXADECIMAL");
    expect(args.hashFunction).toBe("HASH_FUNCTION_SHA256");

    expect(result).toEqual({
      r: "a".repeat(64),
      s: "b".repeat(64),
      v: "00",
    });
  });

  it("respects custom encoding and hashFunction", async () => {
    await signMessage(mockClient, {
      ...baseParams,
      encoding: "PAYLOAD_ENCODING_TEXT_UTF8",
      hashFunction: "HASH_FUNCTION_NOT_APPLICABLE",
    });

    const args = mockClient.signRawPayload.mock.calls[0]![0];
    expect(args.encoding).toBe("PAYLOAD_ENCODING_TEXT_UTF8");
    expect(args.hashFunction).toBe("HASH_FUNCTION_NOT_APPLICABLE");
  });

  it("returns raw r, s, v from response", async () => {
    mockClient.signRawPayload.mockResolvedValue({
      r: "1111111111111111111111111111111111111111111111111111111111111111",
      s: "2222222222222222222222222222222222222222222222222222222222222222",
      v: "1b",
    });

    const result = await signMessage(mockClient, baseParams);
    expect(result.r).toBe(
      "1111111111111111111111111111111111111111111111111111111111111111",
    );
    expect(result.s).toBe(
      "2222222222222222222222222222222222222222222222222222222222222222",
    );
    expect(result.v).toBe("1b");
  });
});
