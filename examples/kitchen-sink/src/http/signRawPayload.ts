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
    requestFn: turnkeyClient.signRawPayload,
  });

  const activityResponse = await activityPoller({
    type: "ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2",
    timestampMs: String(Date.now()),
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      signWith: "<your signing resource>",
      payload: "<your payload>",
      // these parameters will largely be dependent on your use case
      hashFunction: "HASH_FUNCTION_NO_OP",
      encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    },
  });

  console.log(
    "Successfully signed raw payload:",
    activityResponse.result.signRawPayloadResult!
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
