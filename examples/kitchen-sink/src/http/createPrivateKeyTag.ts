import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import { refineNonNull } from "../utils";

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
    requestFn: turnkeyClient.createPrivateKeyTag,
  });

  const privateKeyTagName = "<your desired private key tag name>";
  const privateKeyIds = ["<relevant private key ID>"];

  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEY_TAG",
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      privateKeyTagName,
      privateKeyIds,
    },
    timestampMs: String(Date.now()), // millisecond timestamp
  });

  const privateKeyTagId = refineNonNull(
    activity.result.createPrivateKeyTagResult?.privateKeyTagId
  );

  // Success!
  console.log(
    [
      `New private key tag created!`,
      `- Name: ${privateKeyTagName}`,
      `- Private key tag ID: ${privateKeyTagId}`,
      ``,
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
