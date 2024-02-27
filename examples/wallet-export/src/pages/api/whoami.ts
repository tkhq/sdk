import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";


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

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const organizationId = getWhoamiRequest.organizationId;

  try {
    const whoamiResponse = await turnkeyClient.getWhoami({
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
