import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey } from "@turnkey/sdk-server";

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
    const turnkeyClient = new Turnkey({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const response = await turnkeyClient.apiClient().emailAuth({
      // This is simple in the case of a single organization.
      // If you use sub-organizations for each user, this needs to be replaced by the user's specific sub-organization.
      organizationId:
        request.suborgID || process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      email: request.email,
      targetPublicKey: request.targetPublicKey,
      invalidateExisting: request.invalidateExisting,
    });

    const userId = response.userId;
    if (!userId) {
      throw new Error("Expected a non-null user ID!");
    }

    const apiKeyId = response.apiKeyId;
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
