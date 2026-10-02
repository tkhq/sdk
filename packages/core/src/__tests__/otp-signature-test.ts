import { describe, expect, it, jest } from "@jest/globals";
import { stringToBase64urlString } from "@turnkey/encoding";

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
  buildSignUpBody,
  getClientSignatureMessageForLogin,
  getClientSignatureMessageForLoginV2,
  getClientSignatureMessageForSignup,
  getClientSignatureMessageForSignupV3,
} from "../utils";
import { TurnkeyClient } from "../__clients__/core";
import { OtpType } from "../__types__";

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

describe("OTP client signature messages", () => {
  it("keeps the legacy login and signup message shapes available", () => {
    expect(
      getClientSignatureMessageForLogin({
        verificationToken,
        sessionPublicKey: "session-public-key",
      }),
    ).toEqual({
      message: JSON.stringify({
        login: { publicKey: "session-public-key" },
        tokenId: "verification-token-id",
        type: "USAGE_TYPE_LOGIN",
      }),
      publicKey: verificationPublicKey,
    });
    expect(
      getClientSignatureMessageForSignup({
        verificationToken,
        email: "alice@example.com",
        apiKeys: [],
        authenticators: [],
        oauthProviders: [],
      }),
    ).toEqual({
      message: JSON.stringify({
        signupV2: {
          apiKeys: [],
          authenticators: [],
          oauthProviders: [],
          email: "alice@example.com",
        },
        tokenId: "verification-token-id",
        type: "USAGE_TYPE_SIGNUP",
      }),
      publicKey: verificationPublicKey,
    });
  });

  it("builds the exact strict login message, including optional values", () => {
    expect(
      getClientSignatureMessageForLoginV2({
        verificationToken,
        organizationId: "sub-organization-id",
        publicKey: "session-public-key",
        invalidateExisting: false,
        expirationSeconds: "3600",
        sessionProfileId: "session-profile-id",
      }),
    ).toEqual({
      message: JSON.stringify({
        loginV2: {
          organizationId: "sub-organization-id",
          publicKey: "session-public-key",
          invalidateExisting: false,
          expirationSeconds: "3600",
          sessionProfileId: "session-profile-id",
        },
        tokenId: "verification-token-id",
        type: "USAGE_TYPE_LOGIN",
      }),
      publicKey: verificationPublicKey,
    });
    expect(
      JSON.parse(
        getClientSignatureMessageForLoginV2({
          verificationToken,
          organizationId: "sub-organization-id",
          publicKey: "session-public-key",
        }).message,
      ),
    ).toEqual({
      loginV2: {
        organizationId: "sub-organization-id",
        publicKey: "session-public-key",
      },
      tokenId: "verification-token-id",
      type: "USAGE_TYPE_LOGIN",
    });
  });

  it("derives the strict signup message from the finalized signup request", () => {
    const signUpBody = buildSignUpBody({
      createSubOrgParams: {
        userName: "Alice",
        subOrgName: "Alice's organization",
        userEmail: "alice@example.com",
        userPhoneNumber: "+15555550100",
        apiKeys: [
          {
            apiKeyName: "Session key",
            publicKey: "session-public-key",
            curveType: "API_KEY_CURVE_P256",
            expirationSeconds: "3600",
          },
        ],
        authenticators: [
          {
            authenticatorName: "Alice's passkey",
            challenge: "challenge",
            attestation: {
              credentialId: "credential-id",
              clientDataJson: "client-data-json",
              attestationObject: "attestation-object",
              transports: ["AUTHENTICATOR_TRANSPORT_INTERNAL"],
            },
          },
        ],
        oauthProviders: [
          {
            providerName: "google",
            oidcClaims: {
              iss: "https://accounts.google.com",
              sub: "subject",
              aud: "audience",
            },
          },
        ],
        customWallet: {
          walletName: "Default wallet",
          walletAccounts: [
            {
              curve: "CURVE_SECP256K1",
              pathFormat: "PATH_FORMAT_BIP32",
              path: "m/44'/60'/0'/0/0",
              addressFormat: "ADDRESS_FORMAT_ETHEREUM",
            },
          ],
        },
      },
    });

    const result = getClientSignatureMessageForSignupV3({
      verificationToken,
      parentOrganizationId: "parent-organization-id",
      signUpBody,
    });
    const signedUsage = JSON.parse(result.message);

    expect(result.publicKey).toBe(verificationPublicKey);
    expect(signedUsage).toEqual({
      signupV3: {
        parentOrganizationId: "parent-organization-id",
        subOrganizationName: signUpBody.organizationName,
        rootUsers: [
          {
            userName: signUpBody.userName,
            userEmail: signUpBody.userEmail,
            userPhoneNumber: signUpBody.userPhoneNumber,
            apiKeys: signUpBody.apiKeys,
            authenticators: signUpBody.authenticators,
            oauthProviders: signUpBody.oauthProviders,
          },
        ],
        rootQuorumThreshold: 1,
        wallet: signUpBody.wallet,
      },
      tokenId: "verification-token-id",
      type: "USAGE_TYPE_SIGNUP",
    });
    expect(signedUsage.signupV3).not.toHaveProperty("disableEmailRecovery");
    expect(signedUsage.signupV3).not.toHaveProperty("disableEmailAuth");
    expect(signedUsage.signupV3).not.toHaveProperty("disableSmsAuth");
    expect(signedUsage.signupV3).not.toHaveProperty("disableOtpEmailAuth");
  });

  it("submits a proxySignupV2 request that matches the signed strict usage", async () => {
    const client = new TurnkeyClient({
      organizationId: "parent-organization-id",
    });
    const signWithApiKey = jest.fn(async () => "compact-signature");
    const proxySignupV2 = jest.fn(async (_request: unknown) => ({
      organizationId: "sub-organization-id",
      userId: "user-id",
    }));
    const loginWithOtp = jest.fn(async () => ({
      sessionToken: "session-token",
    }));
    (client as any).signWithApiKey = signWithApiKey;
    (client as any).httpClient = { proxySignupV2 };
    (client as any).loginWithOtp = loginWithOtp;

    await client.signUpWithOtp({
      verificationToken,
      contact: "alice@example.com",
      otpType: OtpType.Email,
      createSubOrgParams: {
        userName: "Alice",
        subOrgName: "Alice's organization",
        userTag: "request-only-tag",
        apiKeys: [],
        authenticators: [],
        oauthProviders: [],
      },
    });

    expect(proxySignupV2).toHaveBeenCalledTimes(1);
    const request = proxySignupV2.mock.calls[0]![0] as any;
    const signedUsage = JSON.parse(request.clientSignature.message);
    expect(request).toMatchObject({
      userName: "Alice",
      userEmail: "alice@example.com",
      userTag: "request-only-tag",
      organizationName: "Alice's organization",
      apiKeys: [],
      authenticators: [],
      oauthProviders: [],
      verificationToken,
    });
    expect(request).not.toHaveProperty("wallet");
    expect(signedUsage.signupV3).toEqual({
      parentOrganizationId: "parent-organization-id",
      subOrganizationName: request.organizationName,
      rootUsers: [
        {
          userName: request.userName,
          userEmail: request.userEmail,
          apiKeys: request.apiKeys,
          authenticators: request.authenticators,
          oauthProviders: request.oauthProviders,
        },
      ],
      rootQuorumThreshold: 1,
    });
    expect(signedUsage.signupV3).not.toHaveProperty("wallet");
    expect(signedUsage.signupV3.rootUsers[0]).not.toHaveProperty("userTag");
    expect(signedUsage.signupV3.rootUsers[0]).not.toHaveProperty("userTagIds");
    expect(signWithApiKey).toHaveBeenCalledWith({
      message: request.clientSignature.message,
      publicKey: verificationPublicKey,
    });
  });
});
