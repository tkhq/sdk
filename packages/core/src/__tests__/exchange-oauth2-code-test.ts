import { describe, expect, it, jest } from "@jest/globals";
import { TurnkeyErrorCodes } from "@turnkey/sdk-types";

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

const mockEncryptOauth2ToBundle = jest.fn(async (_params: unknown) => ({
  encryptedMessage: "encrypted-message",
  targetPublicKey: "target-public-key",
}));
jest.mock("@turnkey/crypto", () => ({
  ...(jest.requireActual("@turnkey/crypto") as object),
  encryptOauth2ToBundle: (params: unknown) => mockEncryptOauth2ToBundle(params),
}));

import { TurnkeyClient } from "../__clients__/core";

describe("exchangeOauth2Code", () => {
  it("encrypts the inputs to the auth proxy target for the configured organization", async () => {
    const proxyInitOAuth2AuthenticateV2 = jest.fn(async () => ({
      oauth2CredentialId: "credential-id",
      enclaveTargetMessage: "target-message",
    }));
    const proxyOAuth2AuthenticateV2 = jest.fn(async () => ({
      oidcToken: "oidc-token",
    }));
    const client = new TurnkeyClient({ organizationId: "parent-org-id" });
    (client as any).httpClient = {
      proxyInitOAuth2AuthenticateV2,
      proxyOAuth2AuthenticateV2,
    };

    const oidcToken = await client.exchangeOauth2Code({
      provider: "OAUTH2_PROVIDER_DISCORD",
      clientId: "client-id",
      authCode: "auth-code",
      codeVerifier: "code-verifier",
      redirectUri: "https://example.com/callback",
      nonce: "nonce",
    });

    expect(oidcToken).toBe("oidc-token");
    expect(proxyInitOAuth2AuthenticateV2).toHaveBeenCalledWith({
      clientId: "client-id",
      encryptionSuite: "TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V2",
    });
    expect(mockEncryptOauth2ToBundle).toHaveBeenCalledWith({
      bundle: {
        organizationId: "parent-org-id",
        oauth2CredentialId: "credential-id",
        clientId: "client-id",
        provider: "OAUTH2_PROVIDER_DISCORD",
        authCode: "auth-code",
        codeVerifier: "code-verifier",
        redirectUri: "https://example.com/callback",
        nonce: "nonce",
      },
      enclaveTargetMessage: "target-message",
    });
    expect(proxyOAuth2AuthenticateV2).toHaveBeenCalledWith({
      oauth2CredentialId: "credential-id",
      encryptedMessage: "encrypted-message",
      targetPublicKey: "target-public-key",
    });
  });

  it.each([
    [
      "the encryption target",
      { oauth2CredentialId: "credential-id", enclaveTargetMessage: "" },
      { oidcToken: "oidc-token" },
    ],
    [
      "the OIDC token",
      {
        oauth2CredentialId: "credential-id",
        enclaveTargetMessage: "target-message",
      },
      { oidcToken: "" },
    ],
  ])(
    "throws OAUTH2_AUTHENTICATE_ERROR when the response is missing %s",
    async (_, initResponse, authenticateResponse) => {
      const client = new TurnkeyClient({ organizationId: "parent-org-id" });
      (client as any).httpClient = {
        proxyInitOAuth2AuthenticateV2: async () => initResponse,
        proxyOAuth2AuthenticateV2: async () => authenticateResponse,
      };

      await expect(
        client.exchangeOauth2Code({
          provider: "OAUTH2_PROVIDER_DISCORD",
          clientId: "client-id",
          authCode: "auth-code",
          codeVerifier: "code-verifier",
          redirectUri: "https://example.com/callback",
          nonce: "nonce",
        }),
      ).rejects.toMatchObject({
        code: TurnkeyErrorCodes.OAUTH2_AUTHENTICATE_ERROR,
      });
    },
  );
});
