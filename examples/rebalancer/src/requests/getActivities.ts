import type { Turnkey, TurnkeyApiTypes } from "@turnkey/sdk-server";
import { refineNonNull } from "./utils";

export default async function getActivities(
  turnkeyClient: Turnkey,
  limit: string
): Promise<TurnkeyApiTypes["v1GetActivitiesResponse"]["activities"]> {
  const response = await turnkeyClient.apiClient().getActivities({
    organizationId: process.env.ORGANIZATION_ID!,
    paginationOptions: {
      limit: limit,
    },
  });

  return refineNonNull(response.activities);
}
