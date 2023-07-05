import { TurnkeyApi, init as httpInit } from "@turnkey/http";
import type { definitions as types } from "../types";
import { refineNonNull } from "./utils";

// TODO(tim): deprecate this
export default async function getOrganization(): Promise<
  types["v1OrganizationData"]
> {
  // Initialize `@turnkey/http` with your credentials
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  const response = await TurnkeyApi.postGetOrganization({
    body: {
      organizationId: process.env.ORGANIZATION_ID!,
    },
  });

  return refineNonNull(response.organizationData);
}