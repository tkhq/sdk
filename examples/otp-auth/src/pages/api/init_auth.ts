import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

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
    const turnkeyClient = new TurnkeySDKClient({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const initOtpAuthResponse = await turnkeyClient.apiClient().initOtpAuth({
      contact: request.contact,
      otpType: request.otpType,
      // This is simple in the case of a single organization.
      // If you use sub-organizations for each user, this needs to be replaced by the user's specific sub-organization.
      organizationId:
        request.suborgID || process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const { otpId } = initOtpAuthResponse;

    if (!otpId) {
      throw new Error("Expected a non-null otpId.");
    }

    res.status(200).json({ otpId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong." });
  }
}
