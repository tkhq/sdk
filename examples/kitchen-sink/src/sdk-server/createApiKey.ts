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

  const userId = "<user id>";
  const apiKeyName = "<API key name>";
  const publicKey = "<API public key>";
  const curveType = "API_KEY_CURVE_P256"; // this is the default

  const { apiKeyIds } = await turnkeyClient.apiClient().createApiKeys({
    userId,
    apiKeys: [
      {
        apiKeyName,
        publicKey,
        curveType,
      },
    ],
  });

  const newApiKeyIds = refineNonNull(apiKeyIds);

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
