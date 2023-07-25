import { TurnkeyApi, init as httpInit, TurnkeyApiTypes } from "@turnkey/http";
import { refineNonNull } from "./utils";

export default async function getOrganization(): Promise<
  TurnkeyApiTypes["v1OrganizationData"]
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
