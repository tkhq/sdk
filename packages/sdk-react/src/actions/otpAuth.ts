"use server";

import { Turnkey } from "@turnkey/sdk-server";

type OtpAuthRequest = {
  suborgID: string;
  otpId: string;
  otpCode: string;
  targetPublicKey: string;
  sessionLength?: number | undefined;
};

type OtpAuthResponse = {
  userId: string;
  apiKeyId: string;
  credentialBundle: string;
};

export async function otpAuth(
  request: OtpAuthRequest
): Promise<OtpAuthResponse | undefined> {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
  });
  try {
    const otpAuthResponse = await turnkeyClient.apiClient().otpAuth({
      otpId: request.otpId,
      otpCode: request.otpCode,
      targetPublicKey: request.targetPublicKey,
      organizationId: request.suborgID,
      ...(request.sessionLength !== undefined && {
        expirationSeconds: request.sessionLength.toString(),
      }),
    });
    const { credentialBundle, apiKeyId, userId } = otpAuthResponse;

    if (!apiKeyId || !credentialBundle || !userId) {
      throw new Error("Expected a non-null otp auth response.");
    }

    return { credentialBundle, apiKeyId, userId };
  } catch (e) {
    return;
  }
}
