import type { TurnkeyClient, TurnkeyApiTypes } from "@turnkey/http";
import { refineNonNull } from "./utils";

export default async function getOrganization(
  turnkeyClient: TurnkeyClient
): Promise<TurnkeyApiTypes["v1OrganizationData"]> {
  const response = await turnkeyClient.getOrganization({
    organizationId: process.env.ORGANIZATION_ID!,
  });

  return refineNonNull(response.organizationData);
}
