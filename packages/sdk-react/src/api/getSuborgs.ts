import type { Turnkey as TurnkeySDKClient } from "@turnkey/sdk-server";

type GetSuborgsRequest = {
  filterValue: string;
  filterType: string;
};

type GetSuborgsResponse = {
  organizationIds: string[];
};

export async function getSuborgs(
  request: GetSuborgsRequest,
  turnkeyClient: TurnkeySDKClient
): Promise<GetSuborgsResponse | undefined> {
  try {
    const response = await turnkeyClient.apiClient().getSubOrgIds({
      organizationId: turnkeyClient.config.defaultOrganizationId,
      filterType: request.filterType,
      filterValue: request.filterValue,
    });

    if (!response || !response.organizationIds) {
      throw new Error("Expected a non-null response with organizationIds.");
    }

    return { organizationIds: response.organizationIds };
  } catch (e) {
    console.error(e);
    return 
  }
}
