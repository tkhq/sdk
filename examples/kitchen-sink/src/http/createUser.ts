import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import { refineNonNull } from "../utils";

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
    requestFn: turnkeyClient.createApiOnlyUsers,
  });

  const userName = "<user name>";
  const userTags = ["<your user tag>"];
  const apiKeyName = "<API key name>";
  const publicKey = "<API public key>";

  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_API_ONLY_USERS",
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      apiOnlyUsers: [
        {
          userName,
          userTags,
          apiKeys: [
            {
              apiKeyName,
              publicKey,
            },
          ],
        },
      ],
    },
    timestampMs: String(Date.now()), // millisecond timestamp
  });

  const userId = refineNonNull(
    activity.result.createApiOnlyUsersResult?.userIds?.[0]
  );

  // Success!
  console.log(
    [
      `New user created!`,
      `- Name: ${userName}`,
      `- User ID: ${userId}`,
      ``,
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
