import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyApiTypes, TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type TPrivateKey = TurnkeyApiTypes["v1PrivateKey"];

type TFormattedPrivateKey = {
  privateKeyId: string;
  privateKeyName: string;
  privateKeyAddress: string;
};

type GetPrivateKeysRequest = {
  organizationId: string;
};

type GetPrivateKeysResponse = {
  privateKeys: TFormattedPrivateKey[];
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

    // By default, the API will return private keys in descending order of create date.
    // We reverse it here, so that visually the most recently created private keys will be
    // added to the bottom of the list instead of the top.
    const privateKeys = privateKeysResponse.privateKeys
      .reverse()
      .map((pk: TPrivateKey) => {
        return {
          privateKeyId: pk.privateKeyId!,
          privateKeyName: pk.privateKeyName!,
          privateKeyAddress: pk.addresses[0].address!,
        };
      });

    res.status(200).json({
      privateKeys,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }

  res.json;
}
