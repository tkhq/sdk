import type { TurnkeyClient } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http";
import { refineNonNull } from "../utils";

export default async function createPrivateKeyTag(
  turnkeyClient: TurnkeyClient,
  privateKeyTagName: string,
  privateKeyIds: string[]
): Promise<string> {
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
  } catch (err: any) {
    throw new Error("Failed to create a new Ethereum private key: " + err);
  }
}
