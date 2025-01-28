import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { refineNonNull } from "../utils";

async function main() {
  console.log("creating a new private key on Turnkey...\n");

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createApiKeys,
  });

  const userId = "<user id>";
  const apiKeyName = "<API key name>";
  const publicKey = "<API public key>";
  const curveType = "API_KEY_CURVE_P256"; // this is the default

  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_API_KEYS_V2",
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      userId,
      apiKeys: [
        {
          apiKeyName,
          publicKey,
          curveType,
        },
      ],
    },
    timestampMs: String(Date.now()), // millisecond timestamp
  });

  const newApiKeyIds = refineNonNull(
    activity.result.createApiKeysResult?.apiKeyIds
  );

  // Success!
  console.log(
    [
      `New API key created!`,
      `- ID: ${newApiKeyIds[0]}`,
      `- Public Key: ${publicKey}`,
      `- Name: ${apiKeyName}`,
      `- User ID: ${userId}`,
      ``,
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
