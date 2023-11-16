import type { TurnkeyClient } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function createUser(
  turnkeyClient: TurnkeyClient,
  userName: string,
  userTags: string[],
  apiKeyName: string,
  publicKey: string
): Promise<string> {
  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createApiOnlyUsers,
  });

  try {
    const activity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_API_ONLY_USERS",
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        apiOnlyUsers: [
          {
            userName,
            userTags,
            apiKeys: [
              {
                apiKeyName,
                publicKey,
              },
            ],
          },
        ],
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const userId = refineNonNull(
      activity.result.createApiOnlyUsersResult?.userIds?.[0]
    );

    // Success!
    console.log(
      [
        `New user created!`,
        `- Name: ${userName}`,
        `- User ID: ${userId}`,
        ``,
      ].join("\n")
    );

    return userId;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to create a new user",
      cause: error as Error,
    });
  }
}
