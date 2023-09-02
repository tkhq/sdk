import type { NextApiRequest, NextApiResponse } from "next";
import { TurnkeyApiTypes, TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

type TActivityResponse = TurnkeyApiTypes["v1ActivityResponse"];

type GetActivityRequest = {
  organizationId: string;
  activityId: string;
};

type ErrorMessage = {
  message: string;
};

// this getter can be performed by the parent org
export default async function getActivity(
  req: NextApiRequest,
  res: NextApiResponse<TActivityResponse | ErrorMessage>
) {
  const getActivityRequest = req.body as GetActivityRequest;

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.NEXT_PUBLIC_BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const { organizationId, activityId } = getActivityRequest;

  try {
    const activityResponse = await turnkeyClient.getActivity({
      organizationId,
      activityId,
    });

    res.status(200).json({
      activity: activityResponse.activity,
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      message: "Something went wrong.",
    });
  }

  res.json;
}
