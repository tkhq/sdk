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

  const userTagName = "<desired tag name>";

  const { userTagId } = await turnkeyClient.apiClient().createUserTag({
    userTagName,
    userIds: [], // relevant user IDs
  });

  const newUserTagId = refineNonNull(userTagId);

  // Success!
  console.log(
    [
      `New user tag created!`,
      `- Name: ${userTagName}`,
      `- User tag ID: ${newUserTagId}`,
      ``,
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
