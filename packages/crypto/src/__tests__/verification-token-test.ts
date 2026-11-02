import { describe, expect, test } from "@jest/globals";
import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha2";
import { uint8ArrayFromHexString } from "@turnkey/encoding";

import {
  AUTH_METHOD_EMAIL_OTP,
  AUTH_METHOD_WALLET,
  NIL_SESSION_PROFILE_SCOPE,
  VERIFICATION_TOKEN_TYPE_V1,
  VerificationToken,
  publicKeyNonce,
} from "../";

const ORG_ID = "org-id";
const JTI = "11111111-1111-4111-8111-111111111111";
const ADDRESS = "0xabc";
const DOMAIN = "app.example.com";

const testPrivKey = uint8ArrayFromHexString(
  "7b2e9c5f4a1d8036e9b0c2a4f6d8e0f123456789abcdef0123456789abcdef01",
);
const testPubKeyHex = Buffer.from(
  p256.getPublicKey(testPrivKey, false),
).toString("hex");
const testKid = (() => {
  const uncompressed = p256.getPublicKey(testPrivKey, false);
  const x = Buffer.from(uncompressed.subarray(1, 33)).toString("base64url");
  const y = Buffer.from(uncompressed.subarray(33, 65)).toString("base64url");
  const canonical = `{"crv":"P-256","kty":"EC","x":"${x}","y":"${y}"}`;
  return Buffer.from(sha256(new TextEncoder().encode(canonical))).toString(
    "base64url",
  );
})();

function ephemeralJwk() {
  const key = p256.getPublicKey(
    uint8ArrayFromHexString("04".repeat(32)),
    false,
  );
  return {
    kty: "EC",
    crv: "P-256",
    x: Buffer.from(key.subarray(1, 33)).toString("base64url"),
    y: Buffer.from(key.subarray(33, 65)).toString("base64url"),
  };
}

function ephemeralCompressedHex() {
  return Buffer.from(
    p256.getPublicKey(uint8ArrayFromHexString("04".repeat(32)), true),
  ).toString("hex");
}

function walletClaims(overrides: Record<string, unknown> = {}) {
  const jwk = ephemeralJwk();
  const compressed = ephemeralCompressedHex();
  return {
    jti: JTI,
    iss: `https://id.turnkey.com/t/${ORG_ID}`,
    aud: `urn:turnkey:org:${ORG_ID}`,
    cnf: { jwk },
    nonce: publicKeyNonce(compressed),
    auth_method: AUTH_METHOD_WALLET,
    sub_id: {
      format: "wallet",
      type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM",
      address: ADDRESS,
      domain: DOMAIN,
    },
    scope: NIL_SESSION_PROFILE_SCOPE,
    iat: 1_700_000_000,
    exp: 4_000_000_000,
    ...overrides,
  };
}

function emailClaims(overrides: Record<string, unknown> = {}) {
  return walletClaims({
    auth_method: AUTH_METHOD_EMAIL_OTP,
    sub_id: { format: "email", email: "user@example.com" },
    ...overrides,
  });
}

function signToken(
  claims: Record<string, unknown>,
  header: Record<string, unknown> = {
    alg: "ES256",
    typ: VERIFICATION_TOKEN_TYPE_V1,
    kid: testKid,
  },
): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${b64url(header)}.${b64url(claims)}`;
  const sig = p256
    .sign(sha256(new TextEncoder().encode(signingInput)), testPrivKey)
    .toCompactRawBytes();
  return `${signingInput}.${Buffer.from(sig).toString("base64url")}`;
}

describe("publicKeyNonce", () => {
  test("is the hex sha256 of the UTF-8 public key", () => {
    expect(publicKeyNonce("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("VerificationToken", () => {
  test("parses and verifies a wallet token", () => {
    const jwt = signToken(walletClaims());
    const token = VerificationToken.parse(jwt);
    token.verify({
      dangerouslyOverrideSignerPublicKey: testPubKeyHex,
      stampPublicKey: ephemeralCompressedHex(),
      targetOrganizationId: ORG_ID,
    });
    expect(token.jti).toBe(JTI);
    expect(token.authMethod).toBe(AUTH_METHOD_WALLET);
    expect(token.ephemeralPublicKey).toBe(ephemeralCompressedHex());
    expect(token.nonce).toBe(publicKeyNonce(ephemeralCompressedHex()));
    expect(token.subId.address).toBe(ADDRESS);
    expect(token.toJSON().cnf.jwk.crv).toBe("P-256");
  });

  test("parses an email OTP token", () => {
    const token = VerificationToken.parse(signToken(emailClaims()));
    expect(token.authMethod).toBe(AUTH_METHOD_EMAIL_OTP);
    expect(token.subId.email).toBe("user@example.com");
  });

  test("keeps extra proto fields on sub_id", () => {
    const token = VerificationToken.parse(
      signToken(
        walletClaims({
          sub_id: {
            format: "wallet",
            type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM",
            address: ADDRESS,
            domain: DOMAIN,
            jwk: {
              kty: "EC",
              crv: "secp256k1",
              x: "abc",
              y: "def",
            },
          },
        }),
      ),
    );
    expect(token.subId.jwk?.crv).toBe("secp256k1");
  });

  test("rejects a nonce that is not hex(sha256(ephemeralPublicKey))", () => {
    expect(() =>
      VerificationToken.parse(
        signToken(walletClaims({ nonce: "aa".repeat(32) })),
      ),
    ).toThrow("nonce does not match the confirmation key");
  });

  test("rejects a non-UUID jti", () => {
    expect(() =>
      VerificationToken.parse(signToken(walletClaims({ jti: "not-a-uuid" }))),
    ).toThrow("jti is invalid");
  });

  test("rejects an unsupported typ", () => {
    expect(() =>
      VerificationToken.parse(
        signToken(walletClaims(), {
          alg: "ES256",
          typ: "JWT",
          kid: testKid,
        }),
      ),
    ).toThrow("unsupported verification token type");
  });

  test("rejects a missing kid", () => {
    expect(() =>
      VerificationToken.parse(
        signToken(walletClaims(), {
          alg: "ES256",
          typ: VERIFICATION_TOKEN_TYPE_V1,
        }),
      ),
    ).toThrow("kid is missing");
  });

  test("rejects an invalid JWT shape", () => {
    expect(() => VerificationToken.parse("invalid.jwt")).toThrow("expected 3");
  });

  test("rejects a wallet token with the wrong auth_method", () => {
    expect(() =>
      VerificationToken.parse(
        signToken(walletClaims({ auth_method: AUTH_METHOD_EMAIL_OTP })),
      ),
    ).toThrow("auth method does not match the subject");
  });

  test("rejects a tampered signature", () => {
    const jwt = signToken(walletClaims());
    const [h, p, s] = jwt.split(".");
    const tampered = `${h}.${p}.${(s![0] === "A" ? "B" : "A") + s!.slice(1)}`;
    const token = VerificationToken.parse(tampered);
    expect(() =>
      token.verify({ dangerouslyOverrideSignerPublicKey: testPubKeyHex }),
    ).toThrow("invalid signature");
  });

  test("rejects a token whose kid is not a trusted production key", () => {
    const token = VerificationToken.parse(signToken(walletClaims()));
    expect(() => token.verify()).toThrow(
      "kid does not match a trusted signing key",
    );
  });

  test("selects the signer whose kid matches among multiple trusted keys", () => {
    const otherPriv = uint8ArrayFromHexString(
      "1c2d3e4f5061728394a5b6c7d8e9f00112233445566778899aabbccddeeff000",
    );
    const otherPub = Buffer.from(p256.getPublicKey(otherPriv, false)).toString(
      "hex",
    );
    const token = VerificationToken.parse(signToken(walletClaims()));
    token.verify({
      dangerouslyOverrideSignerPublicKey: [otherPub, testPubKeyHex],
    });
  });

  test("rejects a kid that is not in the override key set", () => {
    const otherPriv = uint8ArrayFromHexString(
      "1c2d3e4f5061728394a5b6c7d8e9f00112233445566778899aabbccddeeff000",
    );
    const otherPub = Buffer.from(p256.getPublicKey(otherPriv, false)).toString(
      "hex",
    );
    const token = VerificationToken.parse(signToken(walletClaims()));
    expect(() =>
      token.verify({ dangerouslyOverrideSignerPublicKey: otherPub }),
    ).toThrow("kid does not match a trusted signing key");
  });

  test("rejects an expired token", () => {
    const jwt = signToken(walletClaims({ iat: 1, exp: 2 }));
    const token = VerificationToken.parse(jwt);
    expect(() =>
      token.verify({
        dangerouslyOverrideSignerPublicKey: testPubKeyHex,
        nowMs: 3_000,
      }),
    ).toThrow("expired");
  });

  test("rejects a kid that does not match the signing key", () => {
    const jwt = signToken(walletClaims(), {
      alg: "ES256",
      typ: VERIFICATION_TOKEN_TYPE_V1,
      kid: "not-the-thumbprint",
    });
    const token = VerificationToken.parse(jwt);
    expect(() =>
      token.verify({ dangerouslyOverrideSignerPublicKey: testPubKeyHex }),
    ).toThrow("kid does not match a trusted signing key");
  });

  test("rejects a stamp public key that does not match cnf", () => {
    const other = Buffer.from(p256.getPublicKey(testPrivKey, true)).toString(
      "hex",
    );
    const token = VerificationToken.parse(signToken(walletClaims()));
    expect(() =>
      token.verify({
        dangerouslyOverrideSignerPublicKey: testPubKeyHex,
        stampPublicKey: other,
      }),
    ).toThrow("confirmation key does not match the stamp public key");
  });

  test("rejects an organization audience for a different org", () => {
    const token = VerificationToken.parse(signToken(walletClaims()));
    expect(() =>
      token.verify({
        dangerouslyOverrideSignerPublicKey: testPubKeyHex,
        targetOrganizationId: "other-org",
      }),
    ).toThrow("audience does not match the organization");
  });

  test("accepts a suborgs audience for a child org", () => {
    const jwt = signToken(
      walletClaims({ aud: `urn:turnkey:org:${ORG_ID}:suborgs` }),
    );
    const token = VerificationToken.parse(jwt);
    token.verify({
      dangerouslyOverrideSignerPublicKey: testPubKeyHex,
      targetOrganizationId: "child-org",
      parentOrganizationId: ORG_ID,
    });
  });

  test("rejects a suborgs audience when presented as the parent", () => {
    const jwt = signToken(
      walletClaims({ aud: `urn:turnkey:org:${ORG_ID}:suborgs` }),
    );
    const token = VerificationToken.parse(jwt);
    expect(() =>
      token.verify({
        dangerouslyOverrideSignerPublicKey: testPubKeyHex,
        targetOrganizationId: ORG_ID,
        parentOrganizationId: ORG_ID,
      }),
    ).toThrow("audience does not match the organization");
  });
});
