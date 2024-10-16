import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

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
    const turnkeyClient = new TurnkeyClient(
      { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
      new ApiKeyStamper({
        apiPublicKey: process.env.API_PUBLIC_KEY!,
        apiPrivateKey: process.env.API_PRIVATE_KEY!,
      })
    );

    const response = await turnkeyClient.getSubOrgIds(
      {
      organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
      filterType: "OIDC_TOKEN",
      filterValue: request.filterValue
      }
      )


    res.status(200).json(
      response);
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }
}
