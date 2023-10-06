import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type InitRecoveryRequest = {
  email: string;
  targetPublicKey: string;
};

/**
 * Returns the userId starting recovery (available in `INIT_USER_EMAIL_RECOVERY` activity result)
 * as well as the organization ID. These two pieces of information are useful because they are used
 * inside of the RECOVER_USER activity params.
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
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );
    console.log(
      `let's pretend that INIT_RECOVERY (${request.email}, ${request.targetPublicKey}) is posted to Turnkey here, with client ${turnkeyClient.config}`
    );

    res.status(200).json({
      // this userId field is available inside of the `INIT_USER_EMAIL_RECOVERY` activity result.
      // TODO: update this once the call is actually made!
      userId: "TODO",
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
