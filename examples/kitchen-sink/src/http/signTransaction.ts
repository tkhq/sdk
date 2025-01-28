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
    requestFn: turnkeyClient.signTransaction,
  });

  const activityResponse = await activityPoller({
    type: "ACTIVITY_TYPE_SIGN_TRANSACTION_V2",
    timestampMs: String(Date.now()),
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      signWith: "<your signing resource>",
      type: "TRANSACTION_TYPE_ETHEREUM",
      unsignedTransaction: "<your unsigned transaction>",
    },
  });

  console.log(
    "Successfully signed transaction:",
    activityResponse.result.signTransactionResult?.signedTransaction
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
