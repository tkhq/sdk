import { TurnkeyApi, init as httpInit, withAsyncPolling } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import * as crypto from "crypto";

// TODO(tim): refine w/ options
export default async function createUserTag(userTagName: string, userIds: string[]): string {
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

  try {
    const activity = await mutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_USER_TAG",
        organizationId: process.env.ORGANIZATION_ID!,
        parameters: {
            userTagName,
            userIds,
        },
        timestampMs: String(Date.now()), // millisecond timestamp
      },
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

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
