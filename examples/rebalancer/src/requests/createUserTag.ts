import type { TurnkeyClient } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function createUserTag(
  turnkeyClient: TurnkeyClient,
  userTagName: string,
  userIds: string[]
): Promise<string> {
  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createUserTag,
  });

  try {
    const activity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_USER_TAG",
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        userTagName,
        userIds,
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const userTagId = refineNonNull(
      activity.result.createUserTagResult?.userTagId
    );

    // Success!
    console.log(
      [
        `New user tag created!`,
        `- Name: ${userTagName}`,
        `- User tag ID: ${userTagId}`,
        ``,
      ].join("\n")
    );

    return userTagId;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to create a new user tag",
      cause: error as Error,
    });
  }
}
