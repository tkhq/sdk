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
    console.log("1")
    const response = await turnkeyClient.apiClient().getSubOrgIds({
      organizationId: turnkeyClient.config.defaultOrganizationId,
      filterType: request.filterType,
      filterValue: request.filterValue,
    });
    console.log("2")
    console.log(response)
    if (!response || !response.organizationIds) {
      throw new Error("Expected a non-null response with organizationIds.");
    }

    return { organizationIds: response.organizationIds };
  } catch (e) {
    console.error(e);
    return 
  }
}
