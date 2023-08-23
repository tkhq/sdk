import { TurnkeyClient } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http/dist/async";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function createPrivateKeyTag(
  privateKeyTagName: string,
  privateKeyIds: string[]
): Promise<string> {
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

  try {
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

    return privateKeyTagId;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to create a new private key tag",
      cause: error as Error,
    });
  }
}
