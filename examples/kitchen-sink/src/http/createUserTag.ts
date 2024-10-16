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
    requestFn: turnkeyClient.createUserTag,
  });

  const userTagName = "<desired tag name>";

  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_USER_TAG",
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      userTagName,
      userIds: [], // relevant user IDs
    },
    timestampMs: String(Date.now()), // millisecond timestamp
  });

  const userTagId = refineNonNull(
    activity.result.createUserTagResult?.userTagId
  );

  // Success!
  console.log(
    [
      `New user tag created!`,
      `- Name: ${userTagName}`,
      `- User tag ID: ${userTagId}`,
      ``,
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
