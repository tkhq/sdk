"use server";

import { Turnkey } from "@turnkey/sdk-server";

type OauthRequest = {
  suborgID: string;
  oidcToken: string;
  targetPublicKey: string;
  sessionLengthSeconds?: number | undefined; // Desired expiration time in seconds for the generated API key
};

type OauthResponse = {
  userId: string;
  apiKeyId: string;
  credentialBundle: string;
};

export async function oauth(
  request: OauthRequest,
): Promise<OauthResponse | undefined> {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
  });
  try {
    const oauthResponse = await turnkeyClient.apiClient().oauth({
      oidcToken: request.oidcToken,
      targetPublicKey: request.targetPublicKey,
      organizationId: request.suborgID,
      ...(request.sessionLengthSeconds !== undefined && {
        expirationSeconds: request.sessionLengthSeconds.toString(),
      }),
    });

    const { credentialBundle, apiKeyId, userId } = oauthResponse;
    if (!credentialBundle || !apiKeyId || !userId) {
      throw new Error(
        "Expected non-null values for credentialBundle, apiKeyId, and userId.",
      );
    }

    return { credentialBundle, apiKeyId, userId };
  } catch (error) {
    console.error(error);
    return undefined;
  }
}
