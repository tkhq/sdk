import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type AuthRequest = {
  suborgID: string;
  oidcToken: string;
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

    const oauthResponse = await turnkeyClient.apiClient().oauthLogin({
      oidcToken: request.oidcToken,
      publicKey: request.publicKey,
      organizationId: request.suborgID,
    });

    const { session } = oauthResponse;

    if (!session) {
      throw new Error("session not available");
    }

    res.status(200).json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong." });
  }
}
