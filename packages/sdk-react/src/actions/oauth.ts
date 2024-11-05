import type { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type OauthRequest = {
  suborgID: string;
  oidcToken: string;
  targetPublicKey: string;
};

type OauthResponse = {
  userId: string;
  apiKeyId: string;
  credentialBundle: string;
};

export async function oauth(
  request: OauthRequest,
  turnkeyClient: TurnkeySDKClient
): Promise<OauthResponse | undefined> {
  try {
    const oauthResponse = await turnkeyClient.apiClient().oauth({
      oidcToken: request.oidcToken,
      targetPublicKey: request.targetPublicKey,
      organizationId: request.suborgID,
    });

    const { credentialBundle, apiKeyId, userId } = oauthResponse;
    if (!credentialBundle || !apiKeyId || !userId) {
      throw new Error("Expected non-null values for credentialBundle, apiKeyId, and userId.");
    }

    return { credentialBundle, apiKeyId, userId };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}
