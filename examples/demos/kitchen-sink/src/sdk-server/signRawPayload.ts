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

  const { r, s, v } = await turnkeyClient.apiClient().signRawPayload({
    signWith: "<your signing resource>",
    payload: "<your payload>",
    // these parameters will largely be dependent on your use case
    hashFunction: "HASH_FUNCTION_NO_OP",
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
  });

  console.log("Successfully signed raw payload:", { r, s, v });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
