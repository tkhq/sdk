import { TurnkeyClient, TurnkeyApiTypes } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { refineNonNull } from "./utils";

export default async function getActivity(
  activityId: string
): Promise<TurnkeyApiTypes["v1ActivityResponse"]["activity"]> {
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const response = await turnkeyClient.getActivity({
    organizationId: process.env.ORGANIZATION_ID!,
    activityId,
  });

  return refineNonNull(response.activity);
}
