import type { Turnkey, TurnkeySDKApiTypes } from "@turnkey/sdk-server";
import { refineNonNull } from "./utils";

export default async function getActivity(
  turnkeyClient: Turnkey,
  activityId: string,
): Promise<TurnkeySDKApiTypes.v1Activity> {
  const response = await turnkeyClient.apiClient().getActivity({
    organizationId: process.env.ORGANIZATION_ID!,
    activityId,
  });

  return refineNonNull(response.activity);
}
