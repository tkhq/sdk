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

  const { userId, apiKeyId } = await turnkeyClient.apiClient().emailAuth({
    email: "andrew@turnkey.com",
    targetPublicKey: "04ca2c75d4e54839316dd16dda3b50808a41b7c2f34a47f2e9e7c9a2e352197fc2e59f751cc25a1cc1dacf924edd3380007661b2b119e875d12c1ab2e02fbb1c93"
  });

//   const userId = refineNonNull(userId);
//   const apiKeyId = refineNonNull(apiKeyId);

  // Success!
  console.log(
    [
      `Email auth successful!`,
      `- Email Auth API Key ID: ${apiKeyId}`,
    //   `- Public Key: ${publicKey}`,
    //   `- Name: ${apiKeyName}`,
    //   `- User ID: ${userId}`,
      ``,
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
