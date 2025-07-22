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

  const fingerprint = "<your activity fingerprint from an activity response>";

  const approveResponse = await turnkeyClient.apiClient().approveActivity({
    fingerprint,
  });

  // Note: you must specify the expected activity shape below.
  // For example, this is how you would fetch the result of a SignTransaction activity
  const signedTransaction = refineNonNull(approveResponse);

  // Success!
  console.log("Successfully signed transaction:", signedTransaction);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
