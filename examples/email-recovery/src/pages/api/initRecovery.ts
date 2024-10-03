import type { NextApiRequest, NextApiResponse } from "next";

import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type InitRecoveryRequest = {
  email: string;
  targetPublicKey: string;
};

/**
 * Returns the userId starting recovery (available in `INIT_USER_EMAIL_RECOVERY` activity result)
 * as well as the organization ID. These two pieces of information are useful because they are used
 * inside of the `RECOVER_USER` activity params.
 */
type InitRecoveryResponse = {
  userId: string;
  organizationId: string;
};

type ErrorMessage = {
  message: string;
};

export default async function initRecovery(
  req: NextApiRequest,
  res: NextApiResponse<InitRecoveryResponse | ErrorMessage>
) {
  try {
    const request = req.body as InitRecoveryRequest;
    const turnkeyClient = new TurnkeySDKClient({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const emailRecoveryResponse = await turnkeyClient
      .apiClient()
      .initUserEmailRecovery({
        email: request.email,
        targetPublicKey: request.targetPublicKey,
      });

    const { userId } = emailRecoveryResponse;

    if (!userId) {
      throw new Error("Expected a non-null user ID!");
    }

    res.status(200).json({
      userId: userId,
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
