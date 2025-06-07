import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type InitAuthRequest = {
  suborgID: string;
  otpType: string;
  contact: string;
  publicKey: string;
  userIdentifier: string;
};

type InitAuthResponse = {
  otpId: string;
};

type ErrorMessage = {
  message: string;
};

export default async function init_auth(
  req: NextApiRequest,
  res: NextApiResponse<InitAuthResponse | ErrorMessage>,
) {
  try {
    const request = req.body as InitAuthRequest;
    const turnkeyClient = new TurnkeySDKClient({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    // No longer requires a suborganization ID
    // OTPs can now be sent directly under a parent organization's context to any email or phone number
    const initOtpAuthResponse = await turnkeyClient.apiClient().initOtp({
      contact: request.contact,
      otpType: request.otpType,
      userIdentifier: request.publicKey,
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
