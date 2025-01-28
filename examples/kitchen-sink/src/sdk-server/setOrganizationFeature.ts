import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";

async function main() {
  // Initialize a Turnkey client
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const { features } = await turnkeyClient.apiClient().setOrganizationFeature({
    name: "FEATURE_NAME_EMAIL_AUTH",
    value: "",
  });

  console.log(
    "Successfully set organization feature. Updated features:",
    features
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
