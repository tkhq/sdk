import type { TurnkeyClient, TurnkeyApiTypes } from "@turnkey/http";
import { refineNonNull } from "./utils";

export default async function getActivities(
  turnkeyClient: TurnkeyClient,
  limit: string
): Promise<TurnkeyApiTypes["v1GetActivitiesResponse"]["activities"]> {
  const response = await turnkeyClient.getActivities({
    organizationId: process.env.ORGANIZATION_ID!,
    paginationOptions: {
      limit: limit,
    },
  });

  return refineNonNull(response.activities);
}
