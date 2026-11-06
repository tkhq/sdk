import { afterEach, describe, expect, it, jest } from "@jest/globals";

jest.mock(
  "@polyfills/window",
  () => ({
    __esModule: true,
    default: {
      localStorage: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
    },
  }),
  { virtual: true },
);
jest.mock(
  "@utils",
  () => ({
    __esModule: true,
    parseSession: jest.fn(),
  }),
  { virtual: true },
);

import {
  AUTH_METHOD_EMAIL_OTP,
  AUTH_METHOD_WALLET,
  generateP256KeyPair,
} from "@turnkey/crypto";
import { hexStringToBase64url } from "@turnkey/encoding";
import { TurnkeyClient } from "../__clients__/core";
import type { CreatePasskeyResult, CreateSubOrgParams } from "../__types__";
import { encodeTestVerificationToken } from "./shared";

const SESSION_KEY = generateP256KeyPair().publicKey.toLowerCase();
const OTP_KEY = generateP256KeyPair().publicKey.toLowerCase();
const WALLET_KEY = generateP256KeyPair().publicKey.toLowerCase();
const LOGIN_KEY = generateP256KeyPair().publicKey.toLowerCase();
const SESSION_TOKEN = "session-jwt";
const ETH_ADDRESS = "0xabc0000000000000000000000000000000000000";

const PASSKEY: CreatePasskeyResult = {
  encodedChallenge: "encoded-challenge",
  attestation: {
    credentialId: "credential-id",
    clientDataJson: "client-data",
    attestationObject: "attestation-object",
    transports: ["AUTHENTICATOR_TRANSPORT_INTERNAL"],
  },
};

function otpToken(): string {
  return encodeTestVerificationToken(OTP_KEY, {
    auth_method: AUTH_METHOD_EMAIL_OTP,
    sub_id: { format: "email", email: "user@example.com" },
  });
}

function walletToken(): string {
  return encodeTestVerificationToken(WALLET_KEY, {
    jti: "22222222-2222-4222-8222-222222222222",
    auth_method: AUTH_METHOD_WALLET,
    sub_id: {
      format: "wallet",
      type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM",
      address: ETH_ADDRESS,
      domain: "app.example.com",
      jwk: {
        kty: "EC",
        crv: "secp256k1",
        x: hexStringToBase64url("ab".repeat(32)),
        y: hexStringToBase64url("ab".repeat(32)),
      },
    },
  });
}

function createClient() {
  const client = new TurnkeyClient({
    organizationId: "parent-org",
    authProxyConfigId: "proxy-config",
  });

  const proxySignupV3 = jest.fn(async () => ({
    organizationId: "new-suborg",
    appProofs: [{ type: "signup" }],
  }));
  const stampLogin = jest.fn(async () => ({
    session: SESSION_TOKEN,
  }));

  (client as any).httpClient = {
    proxySignupV3,
    stampLogin,
  };
  (client as any).passkeyStamper = {};
  (client as any).apiKeyStamper = {
    listKeyPairs: async () => [SESSION_KEY, OTP_KEY, WALLET_KEY],
  };

  return { client, proxySignupV3, stampLogin };
}

describe("TurnkeyClient.signUpWithPasskey", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("signs a client signature for verification tokens passed in createSubOrgParams", async () => {
    const { client, proxySignupV3, stampLogin } = createClient();
    const otpVerificationToken = otpToken();
    const walletVerificationToken = walletToken();
    const extraAuthenticator: NonNullable<
      CreateSubOrgParams["authenticators"]
    >[number] = {
      authenticatorName: "backup-passkey",
      challenge: "extra-challenge",
      attestation: {
        credentialId: "extra-credential-id",
        clientDataJson: "extra-client-data",
        attestationObject: "extra-attestation-object",
        transports: ["AUTHENTICATOR_TRANSPORT_INTERNAL"],
      },
    };
    const otpAuthenticators = [
      {
        contact: "user@example.com",
        otpType: "OTP_TYPE_EMAIL",
        verificationToken: otpVerificationToken,
      },
    ];
    const walletAuthenticators = [
      {
        type: "WALLET_AUTHENTICATOR_TYPE_ETHEREUM" as const,
        address: ETH_ADDRESS,
        domain: "app.example.com",
        verificationToken: walletVerificationToken,
      },
    ];

    jest
      .spyOn(client, "createApiKeyPair")
      .mockResolvedValueOnce(SESSION_KEY)
      .mockResolvedValueOnce(LOGIN_KEY);
    jest.spyOn(client, "createPasskey").mockResolvedValue(PASSKEY);
    const sign = jest
      .spyOn(client, "signWithApiKey")
      .mockImplementation(async ({ publicKey }) => {
        if (publicKey === OTP_KEY) {
          return "aa".repeat(64);
        }
        if (publicKey === WALLET_KEY) {
          return "bb".repeat(64);
        }
        throw new Error(`unexpected public key ${publicKey}`);
      });
    jest.spyOn(client, "overrideApiKeyStamper").mockResolvedValue(undefined);
    jest.spyOn(client, "storeSession").mockResolvedValue(undefined);
    jest.spyOn(client, "deleteApiKeyPair").mockResolvedValue(undefined);

    const result = await client.signUpWithPasskey({
      passkeyDisplayName: "primary-passkey",
      createSubOrgParams: {
        authenticators: [extraAuthenticator],
        otpAuthenticators,
        walletAuthenticators,
      },
    });

    expect(sign).toHaveBeenCalledTimes(2);
    expect(sign).toHaveBeenCalledWith({
      message: expect.any(String),
      publicKey: OTP_KEY,
    });
    expect(sign).toHaveBeenCalledWith({
      message: expect.any(String),
      publicKey: WALLET_KEY,
    });
    expect(sign).not.toHaveBeenCalledWith(
      expect.objectContaining({ publicKey: SESSION_KEY }),
    );

    expect(proxySignupV3).toHaveBeenCalledTimes(1);
    const signupCalls = proxySignupV3.mock.calls as unknown as [
      [Record<string, any>, string | undefined],
    ];
    const signupBody = signupCalls[0][0];

    expect(signupBody.otpAuthenticators).toEqual(otpAuthenticators);
    expect(signupBody.walletAuthenticators).toEqual(walletAuthenticators);
    expect(signupBody.authenticators).toEqual([
      extraAuthenticator,
      {
        authenticatorName: "primary-passkey",
        challenge: PASSKEY.encodedChallenge,
        attestation: PASSKEY.attestation,
      },
    ]);
    expect(signupBody.apiKeys).toEqual([
      {
        apiKeyName: `passkey-auth-${SESSION_KEY}`,
        publicKey: SESSION_KEY,
        curveType: "API_KEY_CURVE_P256",
        expirationSeconds: "60",
      },
    ]);
    expect(signupBody.clientSignature).toEqual({
      message: expect.any(String),
      signatures: [
        {
          publicKey: OTP_KEY,
          signature: "aa".repeat(64),
          scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
        },
        {
          publicKey: WALLET_KEY,
          signature: "bb".repeat(64),
          scheme: "CLIENT_SIGNATURE_SCHEME_API_P256",
        },
      ],
    });
    expect(JSON.parse(signupBody.clientSignature.message)).toEqual(
      expect.objectContaining({
        type: "USAGE_TYPE_SIGNUP",
        tokenId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
        signupV3: expect.objectContaining({
          otpAuthenticators,
          walletAuthenticators,
          authenticators: signupBody.authenticators,
          apiKeys: signupBody.apiKeys,
        }),
      }),
    );

    expect(stampLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: LOGIN_KEY,
        organizationId: "new-suborg",
      }),
    );
    expect(result).toEqual({
      sessionToken: SESSION_TOKEN,
      appProofs: [{ type: "signup" }],
      credentialId: PASSKEY.attestation.credentialId,
    });
  });
});
