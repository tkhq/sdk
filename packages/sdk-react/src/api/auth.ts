import type {Turnkey as TurnkeySDKClient}  from "@turnkey/sdk-server";

type AuthRequest = {
  suborgID: string;
  otpId: string;
  otpCode: string;
  targetPublicKey: string;
};

type AuthResponse = {
  userId: string;
  apiKeyId: string;
  credentialBundle: string;
};

export async function auth(
  request: AuthRequest,
  turnkeyClient: TurnkeySDKClient
): Promise<AuthResponse | undefined> {
  try {
    const otpAuthResponse = await turnkeyClient.apiClient().otpAuth({
      otpId: request.otpId,
      otpCode: request.otpCode,
      targetPublicKey: request.targetPublicKey,
      organizationId: request.suborgID
    });
    const { credentialBundle, apiKeyId, userId } = otpAuthResponse;

    if (!apiKeyId || !credentialBundle || !userId) {
      throw new Error("Expected a non-null otp auth response.");
    }

    return { credentialBundle, apiKeyId, userId };
  } catch (e) {
    return
  }
}


