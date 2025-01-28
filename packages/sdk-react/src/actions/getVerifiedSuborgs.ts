"use server";

import { Turnkey } from "@turnkey/sdk-server";

type GetSuborgsRequest = {
  filterValue: string;
  filterType: string;
};

type GetSuborgsResponse = {
  organizationIds: string[];
};

export async function getVerifiedSuborgs(
  request: GetSuborgsRequest,
): Promise<GetSuborgsResponse | undefined> {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.NEXT_PUBLIC_BASE_URL!,
    defaultOrganizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!, // DO NOT EXPOSE THESE TO YOUR CLIENT SIDE CODE
  });
  try {
    const response = await turnkeyClient.apiClient().getVerifiedSubOrgIds({
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
    return;
  }
}
