import { describe, expect, test } from "@jest/globals";
import { p256 } from "@noble/curves/p256";
import { uint8ArrayFromHexString } from "@turnkey/encoding";

import {
  AUTH_METHOD_EMAIL_OTP,
  AUTH_METHOD_WALLET,
  ClientSignature,
  NIL_SESSION_PROFILE_SCOPE,
  VERIFICATION_TOKEN_TYPE_V1,
  buildClientSignatureV2,
  collectClientSignaturePublicKeys,
  getClientSignatureMessageForLogin,
  getClientSignatureMessageForSignup,
  oidcTokenNonces,
  publicKeyNonce,
} from "../";

const JTI = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "org-id";
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function compressedHexFromPrivateKey(privateKeyHex: string): string {
  return Buffer.from(
    p256.getPublicKey(uint8ArrayFromHexString(privateKeyHex), true),
  ).toString("hex");
}

function jwkFromPrivateKey(privateKeyHex: string) {
  const uncompressed = p256.getPublicKey(
    uint8ArrayFromHexString(privateKeyHex),
    false,
  );
  return {
    kty: "EC",
    crv: "P-256",
    x: Buffer.from(uncompressed.subarray(1, 33)).toString("base64url"),
    y: Buffer.from(uncompressed.subarray(33, 65)).toString("base64url"),
  };
}

function encodeJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): string {
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signatureB64 = Buffer.alloc(64).toString("base64url");
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

function verificationToken(privateKeyHex: string, authMethod: string): string {
  const compressed = compressedHexFromPrivateKey(privateKeyHex);
  return encodeJwt(
    {
      alg: "ES256",
      typ: VERIFICATION_TOKEN_TYPE_V1,
      kid: "test-kid",
    },
    {
      jti: JTI,
      iss: `https://id.turnkey.com/t/${ORG_ID}`,
      aud: `urn:turnkey:org:${ORG_ID}`,
      cnf: { jwk: jwkFromPrivateKey(privateKeyHex) },
      nonce: publicKeyNonce(compressed),
      auth_method: authMethod,
      sub_id:
        authMethod === AUTH_METHOD_WALLET
          ? {
              format: "wallet",
              type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM",
              address: "0xabc",
              domain: "app.example.com",
            }
          : { format: "email", email: "user@example.com" },
      scope: NIL_SESSION_PROFILE_SCOPE,
      iat: 1_700_000_000,
      exp: 4_000_000_000,
    },
  );
}

function oidcToken(nonce: string, tknonce?: string): string {
  return encodeJwt(
    { alg: "RS256", kid: "test" },
    {
      iss: "https://accounts.google.com",
      aud: "client",
      sub: "user",
      iat: 1,
      exp: 2,
      nonce,
      ...(tknonce ? { tknonce } : {}),
    },
  );
}

const OTP_KEY = "04".repeat(32);
const WALLET_KEY = "05".repeat(32);
const OIDC_KEY = "06".repeat(32);
const UNUSED_KEY = "07".repeat(32);

describe("getClientSignatureMessageForSignup", () => {
  test("builds a signupV3 payload with a random UUID tokenId", () => {
    const walletAuthenticators = [
      {
        type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM" as const,
        address: "0xabc0000000000000000000000000000000000000",
        domain: "app.example.com",
      },
    ];

    const otpAuthenticators = [
      {
        contact: "user@example.com",
        otpType: "OTP_TYPE_EMAIL",
      },
    ];
    const { message, publicKeys } = getClientSignatureMessageForSignup({
      otpAuthenticators,
      walletAuthenticators,
    });
    const parsed = JSON.parse(message);

    expect(publicKeys).toEqual([]);
    expect(parsed).toEqual({
      type: "USAGE_TYPE_SIGNUP",
      tokenId: expect.stringMatching(UUID_V4),
      signupV3: { otpAuthenticators, walletAuthenticators },
    });
    expect(
      JSON.parse(
        getClientSignatureMessageForSignup({ otpAuthenticators }).message,
      ).tokenId,
    ).not.toBe(parsed.tokenId);
  });

  test("matches OTP, wallet, and OIDC tokens to listed public keys by nonce", () => {
    const otpToken = verificationToken(OTP_KEY, AUTH_METHOD_EMAIL_OTP);
    const walletToken = verificationToken(WALLET_KEY, AUTH_METHOD_WALLET);
    const otpPublicKey = compressedHexFromPrivateKey(OTP_KEY);
    const walletPublicKey = compressedHexFromPrivateKey(WALLET_KEY);
    const oidcPublicKey = compressedHexFromPrivateKey(OIDC_KEY);
    const unusedPublicKey = compressedHexFromPrivateKey(UNUSED_KEY);
    const oidc = oidcToken(publicKeyNonce(oidcPublicKey));

    const { publicKeys } = getClientSignatureMessageForSignup(
      {
        oauthProviders: [{ providerName: "Google", oidcToken: oidc }],
      },
      {
        tokens: [otpToken, walletToken, oidc],
        publicKeys: [
          unusedPublicKey,
          otpPublicKey,
          walletPublicKey,
          oidcPublicKey,
        ],
      },
    );

    expect(publicKeys).toEqual([otpPublicKey, walletPublicKey, oidcPublicKey]);
  });

  test("one key covers a generic token and an OIDC token with the same nonce", () => {
    const otpToken = verificationToken(OTP_KEY, AUTH_METHOD_EMAIL_OTP);
    const publicKey = compressedHexFromPrivateKey(OTP_KEY);
    const oidc = oidcToken(publicKeyNonce(publicKey));

    const { publicKeys } = getClientSignatureMessageForSignup(
      {
        oauthProviders: [{ providerName: "Google", oidcToken: oidc }],
      },
      {
        tokens: [otpToken, oidc],
        publicKeys: [publicKey],
      },
    );

    expect(publicKeys).toEqual([publicKey]);
  });
});

describe("collectClientSignaturePublicKeys", () => {
  test("ignores listed keys that match no token", () => {
    const otpToken = verificationToken(OTP_KEY, AUTH_METHOD_EMAIL_OTP);
    const otpPublicKey = compressedHexFromPrivateKey(OTP_KEY);

    expect(
      collectClientSignaturePublicKeys({
        tokens: [otpToken],
        publicKeys: [otpPublicKey, compressedHexFromPrivateKey(UNUSED_KEY)],
      }),
    ).toEqual([otpPublicKey]);
  });

  test("throws when no listed public key matches a token nonce", () => {
    const otpToken = verificationToken(OTP_KEY, AUTH_METHOD_EMAIL_OTP);

    expect(() =>
      collectClientSignaturePublicKeys({
        tokens: [otpToken],
        publicKeys: [compressedHexFromPrivateKey(WALLET_KEY)],
      }),
    ).toThrow(/no stored public key matches the token nonce/);
  });
});

describe("oidcTokenNonces", () => {
  test("returns nonce and distinct tknonce", () => {
    expect(oidcTokenNonces(oidcToken("abc", "def"))).toEqual(["abc", "def"]);
    expect(oidcTokenNonces(oidcToken("abc", "abc"))).toEqual(["abc"]);
  });

  test("throws when both nonce claims are missing", () => {
    const token = encodeJwt(
      { alg: "RS256", kid: "test" },
      { iss: "https://accounts.google.com", aud: "client", sub: "user" },
    );
    expect(() => oidcTokenNonces(token)).toThrow(/missing a nonce/);
  });
});

describe("buildClientSignatureV2", () => {
  test("lowercases public keys and sets the P-256 scheme", () => {
    const clientSignature = buildClientSignatureV2({
      message: "{}",
      signatures: [{ publicKey: "ABCD", signature: "11".repeat(64) }],
    });

    expect(clientSignature).toEqual({
      message: "{}",
      signatures: [
        {
          publicKey: "abcd",
          signature: "11".repeat(64),
          scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
        },
      ],
    });
  });
});

describe("ClientSignature.ProxyTSignupV3Body", () => {
  test("sign matches body tokens to listed public keys", async () => {
    const otpToken = verificationToken(OTP_KEY, AUTH_METHOD_EMAIL_OTP);
    const walletToken = verificationToken(WALLET_KEY, AUTH_METHOD_WALLET);
    const otpPublicKey = compressedHexFromPrivateKey(OTP_KEY);
    const walletPublicKey = compressedHexFromPrivateKey(WALLET_KEY);
    const oidcPublicKey = compressedHexFromPrivateKey(OIDC_KEY);
    const unusedPublicKey = compressedHexFromPrivateKey(UNUSED_KEY);
    const oidc = oidcToken(publicKeyNonce(oidcPublicKey));
    const otpAuthenticators = [
      {
        contact: "user@example.com",
        otpType: "OTP_TYPE_EMAIL",
        verificationToken: otpToken,
      },
    ];
    const body = new ClientSignature.ProxyTSignupV3Body({
      otpAuthenticators,
      apiKeys: [],
      authenticators: [],
      oauthProviders: [
        {
          providerName: "Google",
          oidcToken: oidc,
        },
      ],
      walletAuthenticators: [
        {
          type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM",
          address: "0xabc",
          domain: "app.example.com",
          verificationToken: walletToken,
        },
      ],
    });

    await body.sign(
      async (_message, publicKey) => `sig:${publicKey}`,
      async () => [
        unusedPublicKey,
        otpPublicKey,
        walletPublicKey,
        oidcPublicKey,
      ],
    );

    expect(
      body.clientSignature?.signatures.map((entry) => entry.publicKey),
    ).toEqual([otpPublicKey, walletPublicKey, oidcPublicKey]);
    expect(JSON.parse(body.clientSignature!.message)).toEqual(
      expect.objectContaining({
        type: "USAGE_TYPE_SIGNUP",
        tokenId: expect.stringMatching(UUID_V4),
        signupV3: expect.objectContaining({ otpAuthenticators }),
      }),
    );
  });

  test("sign is a no-op when the body has no tokens", async () => {
    const body = new ClientSignature.ProxyTSignupV3Body({
      otpAuthenticators: [],
      apiKeys: [],
      authenticators: [],
      oauthProviders: [],
      walletAuthenticators: [],
    });
    await body.sign(async () => {
      throw new Error("should not sign");
    });
    expect(body.clientSignature).toBeUndefined();
  });
});

describe("ClientSignature.RootUserParamsV6", () => {
  test("sign matches OTP authenticator tokens to listed public keys", async () => {
    const otpToken = verificationToken(OTP_KEY, AUTH_METHOD_EMAIL_OTP);
    const otpPublicKey = compressedHexFromPrivateKey(OTP_KEY);
    const otpAuthenticators = [
      {
        contact: "user@example.com",
        otpType: "OTP_TYPE_EMAIL",
        verificationToken: otpToken,
      },
    ];
    const rootUserParams = new ClientSignature.RootUserParamsV6({
      userName: "alice",
      otpAuthenticators,
      apiKeys: [],
      authenticators: [],
      oauthProviders: [],
      walletAuthenticators: [],
    });

    const clientSignature = await rootUserParams.sign(
      async () => "11".repeat(64),
      async () => [otpPublicKey],
    );

    expect(clientSignature?.signatures).toEqual([
      {
        publicKey: otpPublicKey,
        signature: "11".repeat(64),
        scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
      },
    ]);
    expect(JSON.parse(JSON.stringify(rootUserParams))).toEqual({
      userName: "alice",
      otpAuthenticators,
      apiKeys: [],
      authenticators: [],
      oauthProviders: [],
      walletAuthenticators: [],
    });
  });
});

describe("getClientSignatureMessageForLogin", () => {
  test("names the verification token jti and the session public key", () => {
    const token = verificationToken(OTP_KEY, AUTH_METHOD_EMAIL_OTP);
    const { message, publicKey } = getClientSignatureMessageForLogin({
      verificationToken: token,
      sessionPublicKey: "session-key",
    });

    expect(publicKey).toBe(compressedHexFromPrivateKey(OTP_KEY));
    expect(JSON.parse(message)).toEqual({
      type: "USAGE_TYPE_LOGIN",
      tokenId: JTI,
      login: { publicKey: "session-key" },
    });
  });
});
