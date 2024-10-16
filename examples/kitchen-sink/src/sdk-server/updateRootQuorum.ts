import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

async function main() {
  // Initialize a Turnkey client
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const usersResponse = await turnkeyClient.apiClient().getUsers();
  const whoamiResponse = await turnkeyClient.apiClient().getWhoami();
  const orgConfigsResponse = await turnkeyClient
    .apiClient()
    .getOrganizationConfigs({
      organizationId: process.env.ORGANIZATION_ID!,
    });

  await turnkeyClient.apiClient().updateRootQuorum({
    threshold: 1,
    userIds: [orgConfigsResponse.configs.quorum?.userIds[0]!], // retain the first root user
  });

  const updatedOrgConfigsResponse = await turnkeyClient
    .apiClient()
    .getOrganizationConfigs({
      organizationId: process.env.ORGANIZATION_ID!,
    });

  console.log({
    users: usersResponse.users,
    whoami: whoamiResponse,
    rootQuorum: orgConfigsResponse.configs.quorum,
    updatedRootQuorum: updatedOrgConfigsResponse.configs.quorum,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
