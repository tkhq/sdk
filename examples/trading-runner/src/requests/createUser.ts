import {
  type TurnkeyServerClient,
  TurnkeyActivityError,
} from "@turnkey/sdk-server";

import { refineNonNull } from "./utils";

export default async function createUser(
  turnkeyClient: TurnkeyServerClient,
  userName: string,
  userTags: string[],
  apiKeyName: string,
  publicKey: string
): Promise<string> {
  try {
    const { userIds } = await turnkeyClient.apiClient().createApiOnlyUsers({
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
    });

    const userId = refineNonNull(userIds?.[0]);

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
