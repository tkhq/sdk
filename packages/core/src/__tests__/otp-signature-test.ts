import { describe, expect, it } from "@jest/globals";
import { stringToBase64urlString } from "@turnkey/encoding";
import {
  buildSignUpBody,
  getClientSignatureMessageForLogin,
  getClientSignatureMessageForLoginV2,
  getClientSignatureMessageForSignup,
  getClientSignatureMessageForSignupV3,
} from "../utils";

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
});
