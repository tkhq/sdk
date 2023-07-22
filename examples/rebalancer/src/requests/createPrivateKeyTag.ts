import { TurnkeyApi, init as httpInit, withAsyncPolling } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

// TODO(tim): refine w/ options
export default async function createPrivateKeyTag(
  privateKeyTagName: string,
  privateKeyIds: string[]
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
    // this method doesn't currently support creating private key tags
    request: TurnkeyApi.postCreatePrivateKeyTag,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  try {
    const activity = await mutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEY_TAG",
        organizationId: process.env.ORGANIZATION_ID!,
        parameters: {
          privateKeyTagName,
          privateKeyIds,
        },
        timestampMs: String(Date.now()), // millisecond timestamp
      },
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
