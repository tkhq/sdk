import type { NextApiRequest, NextApiResponse } from "next";
import { Turnkey } from "@turnkey/sdk-server";

type GetWhoamiRequest = {
  organizationId: string;
};

type GetWhoamiResponse = {
  organizationId: string;
  organizationName: string;
  userId: string;
  username: string;
};

type ErrorMessage = {
  message: string;
};

export default async function getWallets(
  req: NextApiRequest,
  res: NextApiResponse<GetWhoamiResponse | ErrorMessage>
) {
  const getWhoamiRequest = req.body as GetWhoamiRequest;
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  });

  const organizationId = getWhoamiRequest.organizationId;

  try {
    const whoamiResponse = await turnkeyClient.apiClient().getWhoami({
      organizationId,
    });

    res.status(200).json({
      organizationId: whoamiResponse.organizationId,
      organizationName: whoamiResponse.organizationName,
      userId: whoamiResponse.userId,
      username: whoamiResponse.username,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }

  res.json;
}
