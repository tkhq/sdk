import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

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

type ErrorMessage = {
  message: string;
};

export default async function auth(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse | ErrorMessage>
) {
  try {
    const request = req.body as AuthRequest;
    const turnkeyClient = new TurnkeySDKClient({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const otpAuthResponse = await turnkeyClient.apiClient().otpAuth({
      otpId: request.otpId,
      otpCode: request.otpCode,
      targetPublicKey: request.targetPublicKey,
      // This is simple in the case of a single organization.
      // If you use sub-organizations for each user, this needs to be replaced by the user's specific sub-organization.
      organizationId:
        request.suborgID || process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const { credentialBundle, apiKeyId, userId } = otpAuthResponse;

    if (!credentialBundle || !apiKeyId || !userId) {
      throw new Error(
        "Expected non-null values for credentialBundle, apiKeyId, and userId."
      );
    }

    res.status(200).json({ credentialBundle, apiKeyId, userId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong." });
  }
}
