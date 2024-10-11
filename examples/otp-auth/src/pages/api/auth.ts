import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

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
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.otpAuth,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_OTP_AUTH",
      timestampMs: String(Date.now()),
      // This is simple in the case of a single organization.
      // If you use sub-organizations for each user, this needs to be replaced by the user's specific sub-organization.
      organizationId:
        request.suborgID || process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        otpId: request.otpId,
        otpCode: request.otpCode,
        targetPublicKey: request.targetPublicKey,
      },
    });

    const credentialBundle = completedActivity.result.otpAuthResult?.credentialBundle;
    if (!credentialBundle) {
      throw new Error("Expected a non-null user ID!");
    }

    const apiKeyId = completedActivity.result.otpAuthResult?.apiKeyId;
    if (!apiKeyId) {
      throw new Error("Expected a non-null user ID!");
    }

    const userId = completedActivity.result.otpAuthResult?.userId;
    if (!userId) {
      throw new Error("Expected a non-null user ID!");
    }
    res.status(200).json({
      credentialBundle,
      apiKeyId,
      userId
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}