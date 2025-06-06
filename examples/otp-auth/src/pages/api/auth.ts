import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type AuthRequest = {
  suborgID: string;
  otpId: string;
  otpCode: string;
  publicKey: string;
};

type AuthResponse = {
  session: string;
};

type ErrorMessage = {
  message: string;
};

export default async function auth(
  req: NextApiRequest,
  res: NextApiResponse<AuthResponse | ErrorMessage>,
) {
  try {
    const request = req.body as AuthRequest;
    const turnkeyClient = new TurnkeySDKClient({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    // Returns a `verificationToken`, which is required for creating sessions via the `otpLogin` action.
    const otpAuthResponse = await turnkeyClient.apiClient().verifyOtp({
      otpId: request.otpId,
      otpCode: request.otpCode,
    });

    const verificationToken = otpAuthResponse.verificationToken;

    if (!verificationToken) {
      throw new Error("verificationToken not available.");
    }

    // Creates a session using a previously obtained `verificationToken`.
    // Returns a session JWT.
    const otpLoginResponse = await turnkeyClient.apiClient().otpLogin({
      organizationId: request.suborgID,
      verificationToken: verificationToken,
      publicKey: request.publicKey,
    });

    const { session } = otpLoginResponse;

    res.status(200).json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong." });
  }
}
