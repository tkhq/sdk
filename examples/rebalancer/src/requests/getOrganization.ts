import { TurnkeyClient, TurnkeyApiTypes } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { refineNonNull } from "./utils";

export default async function getOrganization(): Promise<
  TurnkeyApiTypes["v1OrganizationData"]
> {
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const response = await turnkeyClient.getOrganization({
    organizationId: process.env.ORGANIZATION_ID!,
  });

  return refineNonNull(response.organizationData);
}
