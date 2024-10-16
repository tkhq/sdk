import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type CreateSuborgRequest = {
  oauthProviders: Provider[];
};

type Provider = {
  providerName: string;
  oidcToken: string;
};

type CreateSuborgResponse = {
  subOrganizationId: string;
};
type ErrorMessage = {
  message: string;
};

export default async function createSuborg(
  req: NextApiRequest,
  res: NextApiResponse<CreateSuborgResponse | ErrorMessage>
) {
  try {
    const request = req.body as CreateSuborgRequest;
    const turnkeyClient = new TurnkeySDKClient({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const suborgResponse = await turnkeyClient
      .apiClient()
      .createSubOrganization({
        subOrganizationName: `example-suborg-${String(Date.now())}`,
        rootQuorumThreshold: 1,
        rootUsers: [
          {
            userName: `example-user-${String(Date.now())}`,
            userEmail: "",
            userPhoneNumber: "",
            apiKeys: [],
            authenticators: [],
            oauthProviders: request.oauthProviders,
          },
        ],
      });

    const { subOrganizationId } = suborgResponse;
    if (!subOrganizationId) {
      throw new Error("Expected a non-null subOrganizationId.");
    }

    res.status(200).json({ subOrganizationId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong." });
  }
}
