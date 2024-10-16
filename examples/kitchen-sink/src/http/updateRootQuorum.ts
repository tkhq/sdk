import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

async function main() {
  // Initialize a Turnkey client
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.updateRootQuorum,
  });

  const usersResponse = await turnkeyClient.getUsers({
    organizationId: process.env.ORGANIZATION_ID!,
  });
  const whoamiResponse = await turnkeyClient.getWhoami({
    organizationId: process.env.ORGANIZATION_ID!,
  });
  const orgConfigsResponse = await turnkeyClient.getOrganizationConfigs({
    organizationId: process.env.ORGANIZATION_ID!,
  });

  await activityPoller({
    type: "ACTIVITY_TYPE_UPDATE_ROOT_QUORUM",
    timestampMs: String(Date.now()),
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      threshold: 1,
      userIds: [orgConfigsResponse.configs.quorum?.userIds[0]!], // retain the first root user
    },
  });

  const updatedOrgConfigsResponse = await turnkeyClient.getOrganizationConfigs({
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
