import { TurnkeyApi, init as httpInit, withAsyncPolling } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import * as crypto from "crypto";

// TODO(tim): refine
export default async function createUser() {
  // Initialize `@turnkey/http` with your credentials
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  // Use `withAsyncPolling` to handle async activity polling.
  // In this example, it polls every 250ms until the activity reaches a terminal state.
  const mutation = withAsyncPolling({
    request: TurnkeyApi.postCreatePrivateKeys,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  const userName = `User ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const activity = await mutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_API_ONLY_USERS",
        organizationId: process.env.ORGANIZATION_ID!,
        parameters: {
          apiOnlyUsers: [{
            userName,
            userTags: [],
            apiKeys: [{
                apiKeyName: "Demo Key",
                publicKey: "0253bb13e71f19dd9ccc3639f65fb78245adc7069b108965f426a550d0cc040946",
            }],
          }],
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

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
