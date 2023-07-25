import { TurnkeyApi, init as httpInit } from "@turnkey/http";
import { refineNonNull } from "./utils";

export default async function getActivity(activityId: string): Promise<any> {
  // Initialize `@turnkey/http` with your credentials
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  const response = await TurnkeyApi.getActivity({
    body: {
      organizationId: process.env.ORGANIZATION_ID!,
      activityId,
    },
  });

  return refineNonNull(response.activity);
}
