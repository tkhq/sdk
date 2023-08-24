import type { TurnkeyClient, TurnkeyApiTypes } from "@turnkey/http";
import { refineNonNull } from "./utils";

export default async function getActivity(
  turnkeyClient: TurnkeyClient,
  activityId: string
): Promise<TurnkeyApiTypes["v1ActivityResponse"]["activity"]> {
  const response = await turnkeyClient.getActivity({
    organizationId: process.env.ORGANIZATION_ID!,
    activityId,
  });

  return refineNonNull(response.activity);
}
