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

  const { signedTransaction } = await turnkeyClient
    .apiClient()
    .signTransaction({
      signWith: "<your signing resource>",
      type: "TRANSACTION_TYPE_ETHEREUM",
      unsignedTransaction: "<your unsigned transaction>",
    });

  console.log("Successfully signed transaction:", signedTransaction);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
