import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyApiTypes, TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type TPrivateKey = TurnkeyApiTypes["v1PrivateKey"];

type GetPrivateKeysRequest = {
  organizationId: string;
};

type GetPrivateKeysResponse = {
  privateKeys: TPrivateKey[];
};

type ErrorMessage = {
  message: string;
};

// This getter _can_ be performed by the parent org
export default async function getPrivateKeys(
  req: NextApiRequest,
  res: NextApiResponse<GetPrivateKeysResponse | ErrorMessage>
) {
  const getPrivateKeysRequest = req.body as GetPrivateKeysRequest;

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const organizationId = getPrivateKeysRequest.organizationId;

  try {
    const privateKeysResponse = await turnkeyClient.getPrivateKeys({
      organizationId,
    });

    res.status(200).json({
      privateKeys: privateKeysResponse.privateKeys,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }

  res.json;
}
