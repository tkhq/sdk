import { TurnkeyClient, TurnkeyActivityError } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http/dist/async";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import * as crypto from "crypto";
import { refineNonNull } from "./shared";

export async function createNewCosmosPrivateKey() {
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  console.log(
    "`process.env.PRIVATE_KEY_ID` not found; creating a new Cosmos private key on Turnkey...\n"
  );

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createPrivateKeys,
  });

  const privateKeyName = `Cosmos Key ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const activity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        privateKeys: [
          {
            privateKeyName,
            curve: "CURVE_SECP256K1",
            addressFormats: [],
            privateKeyTags: [],
          },
        ],
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const privateKeyId = refineNonNull(
      activity.result.createPrivateKeysResultV2?.privateKeys?.[0]?.privateKeyId
    );

    // Success!
    console.log(
      [
        `New Cosmos private key created!`,
        `- Name: ${privateKeyName}`,
        `- Private key ID: ${privateKeyId}`,
        ``,
        "Now you can take the private key ID, put it in `.env.local`, then re-run the script.",
      ].join("\n")
    );
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: `Failed to create a new Cosmos private key: ${
        (error as Error).message
      }`,
      cause: error as Error,
    });
  }
}
