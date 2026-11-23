import { describe, expect, it, jest } from "@jest/globals";
import { TurnkeyErrorCodes } from "@turnkey/sdk-types";

const mockEncryptOauth2ToBundle = jest.fn(async (_params: unknown) => ({
  encryptedMessage: "encrypted-message",
  targetPublicKey: "target-public-key",
}));
jest.mock("@turnkey/crypto", () => ({
  ...(jest.requireActual("@turnkey/crypto") as object),
  encryptOauth2ToBundle: (params: unknown) => mockEncryptOauth2ToBundle(params),
}));

import { TurnkeyApiClient } from "../sdk-client";

const params = {
  oauth2CredentialId: "credential-id",
  provider: "OAUTH2_PROVIDER_X",
  clientId: "client-id",
  authCode: "auth-code",
  codeVerifier: "code-verifier",
  redirectUri: "https://example.com/callback",
  nonce: "nonce",
} as const;

function createClient(enclaveTargetMessage: string, oidcToken: string) {
  const client = new TurnkeyApiClient({
    stamper: {
      stamp: async () => ({
        stampHeaderName: "X-Stamp",
        stampHeaderValue: "stamp",
      }),
    },
    apiBaseUrl: "https://mocked.turnkey.com",
    organizationId: "org-id",
  });
  const initOauth2Authenticate = jest.fn(
    async (_input: unknown) => ({ enclaveTargetMessage }) as any,
  );
  const oauth2Authenticate = jest.fn(
    async (_input: unknown) => ({ oidcToken }) as any,
  );
  client.initOauth2Authenticate = initOauth2Authenticate;
  client.oauth2Authenticate = oauth2Authenticate;

  return { client, initOauth2Authenticate, oauth2Authenticate };
}

describe("exchangeOauth2Code", () => {
  it("encrypts the inputs to the credential's target for the organization", async () => {
    const { client, initOauth2Authenticate, oauth2Authenticate } = createClient(
      "target-message",
      "oidc-token",
    );

    await expect(client.exchangeOauth2Code(params)).resolves.toBe("oidc-token");
    expect(initOauth2Authenticate).toHaveBeenCalledWith({
      organizationId: "org-id",
      oauth2CredentialId: "credential-id",
      encryptionSuite: "TRANSPORT_ENCRYPTION_SUITE_ENCLAVE_ENCRYPT_V2",
    });
    expect(mockEncryptOauth2ToBundle).toHaveBeenCalledWith({
      bundle: {
        organizationId: "org-id",
        oauth2CredentialId: "credential-id",
        provider: "OAUTH2_PROVIDER_X",
        clientId: "client-id",
        authCode: "auth-code",
        codeVerifier: "code-verifier",
        redirectUri: "https://example.com/callback",
        nonce: "nonce",
      },
      enclaveTargetMessage: "target-message",
    });
    expect(oauth2Authenticate).toHaveBeenCalledWith({
      organizationId: "org-id",
      oauth2CredentialId: "credential-id",
      encryptedMessage: "encrypted-message",
      targetPublicKey: "target-public-key",
    });
  });

  it.each([
    ["the encryption target", "", "oidc-token"],
    ["the OIDC token", "target-message", ""],
  ])(
    "throws OAUTH2_AUTHENTICATE_ERROR when the response is missing %s",
    async (_, enclaveTargetMessage, oidcToken) => {
      const { client } = createClient(enclaveTargetMessage, oidcToken);

      await expect(client.exchangeOauth2Code(params)).rejects.toMatchObject({
        code: TurnkeyErrorCodes.OAUTH2_AUTHENTICATE_ERROR,
      });
    },
  );
});
