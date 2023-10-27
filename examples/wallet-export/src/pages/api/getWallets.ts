import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyApiTypes, TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type TWallet = TurnkeyApiTypes["v1Wallet"];

type GetWalletsRequest = {
  organizationId: string;
};

type GetWalletsResponse = {
  wallets: TWallet[];
};

type ErrorMessage = {
  message: string;
};

export default async function getWallets(
  req: NextApiRequest,
  res: NextApiResponse<GetWalletsResponse | ErrorMessage>
) {
  const getWalletsRequest = req.body as GetWalletsRequest;

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const organizationId = getWalletsRequest.organizationId;

  try {
    const walletsResponse = await turnkeyClient.getWallets({
      organizationId,
    });

    res.status(200).json({
      wallets: walletsResponse.wallets,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }

  res.json;
}
