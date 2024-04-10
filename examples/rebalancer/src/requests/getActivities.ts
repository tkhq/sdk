import type { TurnkeyServerSDK, TurnkeyApiTypes } from "@turnkey/sdk-js-server";
import { refineNonNull } from "./utils";

export default async function getActivities(
  turnkeyClient: TurnkeyServerSDK,
  limit: string
): Promise<TurnkeyApiTypes["v1GetActivitiesResponse"]["activities"]> {
  const response = await turnkeyClient.api().getActivities({
    organizationId: process.env.ORGANIZATION_ID!,
    paginationOptions: {
      limit: limit,
    },
  });

  return refineNonNull(response.activities);
}
