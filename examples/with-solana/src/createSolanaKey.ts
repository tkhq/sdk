import {
  TurnkeyApi,
  withAsyncPolling,
  TurnkeyActivityError,
} from "@turnkey/http";
import * as crypto from "crypto";

export async function createNewSolanaPrivateKey(turnkeyOrganizationId: string) {
  console.log(
    "creating a new Solana private key on your Turnkey organization...\n"
  );

  const createKeyMutation = withAsyncPolling({
    request: TurnkeyApi.postCreatePrivateKeys,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  const privateKeyName = `Solana Key ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const activity = await createKeyMutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
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
      },
    });

    const privateKeyId =
      activity.result.createPrivateKeysResult?.privateKeyIds?.[0];
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
