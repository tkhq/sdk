import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import * as crypto from "crypto";

import { refineNonNull } from "../utils";

async function main() {
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  console.log("creating a new Solana private key on Turnkey...");

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createPrivateKeys,
  });

  const privateKeyName = `SOL Key ${crypto.randomBytes(2).toString("hex")}`;

  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      privateKeys: [
        {
          privateKeyName,
          curve: "CURVE_ED25519",
          addressFormats: ["ADDRESS_FORMAT_SOLANA"],
          privateKeyTags: [],
        },
      ],
    },
    timestampMs: String(Date.now()), // millisecond timestamp
  });

  const privateKeys = refineNonNull(
    activity.result.createPrivateKeysResultV2?.privateKeys
  );
  const privateKeyId = refineNonNull(privateKeys?.[0]?.privateKeyId);
  const address = refineNonNull(privateKeys?.[0]?.addresses?.[0]?.address);

  // Success!
  console.log(
    [
      `New Solana private key created!`,
      `- Name: ${privateKeyName}`,
      `- Private key ID: ${privateKeyId}`,
      `- Address: ${address}`,
      ``,
      "Now you can take the private key ID, put it in `.env.local`, then re-run the script.",
    ].join("\n")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
