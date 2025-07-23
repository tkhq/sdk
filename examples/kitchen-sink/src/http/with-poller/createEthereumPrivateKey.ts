import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import * as crypto from "crypto";
import { refineNonNull } from "../../utils";

async function main() {
  console.log("creating a new private key on Turnkey...\n");

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    }),
  );

  const privateKeyName = `ETH Key ${crypto.randomBytes(2).toString("hex")}`;

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createPrivateKeys,
  });

  const completedActivity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      privateKeys: [
        {
          privateKeyName,
          curve: "CURVE_SECP256K1",
          addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
          privateKeyTags: [],
        },
      ],
    },
    timestampMs: String(Date.now()),
  });

  const privateKey = refineNonNull(
    completedActivity.result.createPrivateKeysResultV2?.privateKeys?.[0],
  );
  const privateKeyId = refineNonNull(privateKey.privateKeyId);
  const address = refineNonNull(privateKey.addresses?.[0]?.address);

  // Success!
  console.log(
    [
      `New Ethereum private key created!`,
      `- Name: ${privateKeyName}`,
      `- Private key ID: ${privateKeyId}`,
      `- Address: ${address}`,
      ``,
      "Now you can take the private key ID, put it in `.env.local`, then re-run the script.",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
