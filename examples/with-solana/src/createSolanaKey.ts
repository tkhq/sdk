import {
  TurnkeyActivityError,
  TurnkeyClient,
  createActivityPoller,
} from "@turnkey/http";
import * as crypto from "crypto";

export async function createNewSolanaPrivateKey(
  client: TurnkeyClient,
  turnkeyOrganizationId: string
) {
  console.log(
    "creating a new Solana private key on your Turnkey organization...\n"
  );

  const privateKeyName = `Solana Key ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const activityPoller = createActivityPoller({
      client: client,
      requestFn: client.createPrivateKeys,
    });

    const completedActivity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
      organizationId: turnkeyOrganizationId,
      parameters: {
        privateKeys: [
          {
            privateKeyName,
            curve: "CURVE_ED25519",
            addressFormats: [],
            privateKeyTags: [],
          },
        ],
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const privateKeyId =
      completedActivity.result.createPrivateKeysResultV2?.privateKeys[0]
        ?.privateKeyId;
    if (!privateKeyId) {
      console.error(
        "activity doesn't contain a valid private key ID",
        privateKeyId
      );
      process.exit(1);
    }

    console.log(
      [
        `New Solana private key created!`,
        `- Name: ${privateKeyName}`,
        `- Private key ID: ${privateKeyId}`,
      ].join("\n")
    );
    return privateKeyId;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: `Failed to create a new Solana private key: ${
        (error as Error).message
      }`,
      cause: error as Error,
    });
  }
}
