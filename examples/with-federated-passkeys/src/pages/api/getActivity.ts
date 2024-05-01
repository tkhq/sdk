import type { NextApiRequest, NextApiResponse } from "next";
import {
  Turnkey as TurnkeyServerSDK,
  TurnkeyApiTypes,
} from "@turnkey/sdk-server";

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

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
  });

  const { organizationId, activityId } = getActivityRequest;

  try {
    const activityResponse = await turnkeyClient.apiClient().getActivity({
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
