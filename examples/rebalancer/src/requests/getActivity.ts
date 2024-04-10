import type { TurnkeyServerSDK, TurnkeyApiTypes } from "@turnkey/sdk-js-server";
import { refineNonNull } from "./utils";

export default async function getActivity(
  turnkeyClient: TurnkeyServerSDK,
  activityId: string
): Promise<TurnkeyApiTypes["v1ActivityResponse"]["activity"]> {
  const response = await turnkeyClient.api().getActivity({
    organizationId: process.env.ORGANIZATION_ID!,
    activityId,
  });

  return refineNonNull(response.activity);
}
