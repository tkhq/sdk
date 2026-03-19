import type { Turnkey, TurnkeySDKApiTypes } from "@turnkey/sdk-server";
import { refineNonNull } from "./utils";

export default async function getActivities(
  turnkeyClient: Turnkey,
  limit: string,
): Promise<TurnkeySDKApiTypes.v1Activity[]> {
  const response = await turnkeyClient.apiClient().getActivities({
    organizationId: process.env.ORGANIZATION_ID!,
    paginationOptions: {
      limit: limit,
    },
  });

  return refineNonNull(response.activities);
}
