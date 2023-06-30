import { TurnkeyApi, init as httpInit, withAsyncPolling } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

// TODO(tim): refine w/ options
export default async function createUser(
  userName: string,
  userTags: string[],
  apiKeyName: string,
  publicKey: string
): Promise<string> {
  // Initialize `@turnkey/http` with your credentials
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  // Use `withAsyncPolling` to handle async activity polling.
  // In this example, it polls every 250ms until the activity reaches a terminal state.
  const mutation = withAsyncPolling({
    request: TurnkeyApi.postCreateApiOnlyUsers,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  try {
    const activity = await mutation({
      body: {
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
      },
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
