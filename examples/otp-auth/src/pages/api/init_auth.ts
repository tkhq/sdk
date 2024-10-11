import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type InitAuthRequest = {
  suborgID: string;
  otpType: string;
  contact: string;
};

type InitAuthResponse = {
  otpId: string;
};
type ErrorMessage = {
  message: string;
};

export default async function init_auth(
  req: NextApiRequest,
  res: NextApiResponse<InitAuthResponse | ErrorMessage>
) {
  try {
    const request = req.body as InitAuthRequest;
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const activityPoller = createActivityPoller({
      client: turnkeyClient,
      requestFn: turnkeyClient.initOtpAuth,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_INIT_OTP_AUTH",
      timestampMs: String(Date.now()),
      // This is simple in the case of a single organization.
      // If you use sub-organizations for each user, this needs to be replaced by the user's specific sub-organization.
      organizationId:
        request.suborgID || process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      parameters: {
        contact: request.contact,
        otpType: request.otpType,
      },
    });

    const otpId = completedActivity.result.initOtpAuthResult?.otpId;
    if (!otpId) {
      throw new Error("Expected a non-null user ID!");
    }

    res.status(200).json({
      otpId,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
