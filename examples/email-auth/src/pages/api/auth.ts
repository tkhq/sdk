import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type AuthRequest = {
  suborgID: string;
  email: string;
  targetPublicKey: string;
  invalidateExisting: boolean;
};

/**
 * Returns the user ID and (newly created) api key ID (available in `EMAIL_AUTH` activity result)
 * as well as the organization ID
 */
type AuthResponse = {
  userId: string;
  apiKeyId: string;
  organizationId: string;
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
      requestFn: turnkeyClient.emailAuth,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_EMAIL_AUTH",
      timestampMs: String(Date.now()),
      // This is simple in the case of a single organization.
      // If you use sub-organizations for each user, this needs to be replaced by the user's specific sub-organization.
      organizationId:
        request.suborgID || process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        email: request.email,
        targetPublicKey: request.targetPublicKey,
        invalidateExisting: request.invalidateExisting,
      },
    });

    const userId = completedActivity.result.emailAuthResult?.userId;
    if (!userId) {
      throw new Error("Expected a non-null user ID!");
    }

    const apiKeyId = completedActivity.result.emailAuthResult?.apiKeyId;
    if (!apiKeyId) {
      throw new Error("Expected a non-null API key ID!");
    }

    res.status(200).json({
      userId,
      apiKeyId,
      // This is simple in the case of a single organization
      // If you use sub-organizations for each user, this needs to be replaced by the user's specific sub-organization.
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
