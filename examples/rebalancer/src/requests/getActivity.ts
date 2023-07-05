import { TurnkeyApi, init as httpInit } from "@turnkey/http";
// import type { definitions as types } from "../types";
import { refineNonNull } from "./utils";

// TODO(tim): deprecate this
export default async function getActivity(activityId: string): Promise<any> {
  // Initialize `@turnkey/http` with your credentials
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  const response = await TurnkeyApi.postGetActivity({
    body: {
      organizationId: process.env.ORGANIZATION_ID!,
      activityId,
    },
  });

  return refineNonNull(response.activity);
}
