import type { Turnkey, TurnkeyApiTypes } from "@turnkey/sdk-server";
import { refineNonNull } from "./utils";

export default async function getActivity(
  turnkeyClient: Turnkey,
  activityId: string
): Promise<TurnkeyApiTypes["v1ActivityResponse"]["activity"]> {
  const response = await turnkeyClient.apiClient().getActivity({
    organizationId: process.env.ORGANIZATION_ID!,
    activityId,
  });

  return refineNonNull(response.activity);
}
