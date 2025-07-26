import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { refineNonNull } from "../utils";

async function main() {
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    }),
  );

  // Get activities with a particular status
  const pendingActivities = await turnkeyClient.getActivities({
    organizationId: process.env.ORGANIZATION_ID!,
    filterByStatus: ["ACTIVITY_STATUS_PENDING"],
  });

  for (let i = 0; i < pendingActivities.activities.length; i++) {
    const pendingActivity = pendingActivities.activities[i];
    const { fingerprint } = pendingActivity!;

    const rejectResponse = await turnkeyClient.rejectActivity({
      organizationId: process.env.ORGANIZATION_ID!,
      type: "ACTIVITY_TYPE_REJECT_ACTIVITY",
      parameters: {
        fingerprint,
      },
      timestampMs: String(Date.now()), // millisecond timestamp
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
