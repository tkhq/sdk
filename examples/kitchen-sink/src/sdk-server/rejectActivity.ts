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

  // Get activities with a particular status
  const pendingActivities = await turnkeyClient.apiClient().getActivities({
    filterByStatus: ["ACTIVITY_STATUS_PENDING"],
  });

  for (let i = 0; i < pendingActivities.activities.length; i++) {
    const pendingActivity = pendingActivities.activities[i];
    const { fingerprint } = pendingActivity!;

    const rejectResponse = await turnkeyClient.apiClient().rejectActivity({
      fingerprint,
    });

    refineNonNull(rejectResponse);

    // Success!
    console.log("Successfully rejected activity:", rejectResponse);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
