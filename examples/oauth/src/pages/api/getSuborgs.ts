import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type GetSuborgsRequest = {
  filterValue: string;
};

type GetSuborgsResponse = {
  organizationIds: string[];
};
type ErrorMessage = {
  message: string;
};

export default async function getSuborgs(
  req: NextApiRequest,
  res: NextApiResponse<GetSuborgsResponse | ErrorMessage>
) {
  try {
    const request = req.body as GetSuborgsRequest;
    const turnkeyClient = new TurnkeySDKClient({
      apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
      defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    });

    const response = await turnkeyClient.apiClient().getSubOrgIds({
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      filterType: "OIDC_TOKEN",
      filterValue: request.filterValue,
    });

    res.status(200).json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Something went wrong." });
  }
}
