import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import { refineNonNull } from "../utils";

async function main() {
  // Initialize a Turnkey client
  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const userName = "<user name>";
  const userTags = ["<your user tag>"];
  const apiKeyName = "<API key name>";
  const publicKey = "<API public key>";

  const { userIds } = await turnkeyClient.apiClient().createApiOnlyUsers({
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
  });

  const userId = refineNonNull(userIds[0]);

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
