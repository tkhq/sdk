import {
  init as httpInit,
  TurnkeyApi,
  withAsyncPolling,
  TurnkeyActivityError,
} from "@turnkey/http";
import * as crypto from "crypto";
import { refineNonNull } from "./shared";

export async function createNewCosmosPrivateKey() {
  // Initialize `@turnkey/http` with your credentials
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  console.log(
    "`process.env.PRIVATE_KEY_ID` not found; creating a new Cosmos private key on Turnkey...\n"
  );

  // Use `withAsyncPolling` to handle async activity polling.
  // In this example, it polls every 250ms until the activity reaches a terminal state.
  const createKeyMutation = withAsyncPolling({
    request: TurnkeyApi.createPrivateKeys,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  const privateKeyName = `Cosmos Key ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const activity = await createKeyMutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        organizationId: process.env.ORGANIZATION_ID!,
        parameters: {
          privateKeys: [
            {
              privateKeyName,
              curve: "CURVE_SECP256K1",
              addressFormats: [],
              privateKeyTags: [],
            },
          ],
        },
        timestampMs: String(Date.now()), // millisecond timestamp
      },
    });

    const privateKeyId = refineNonNull(
      activity.result.createPrivateKeysResult?.privateKeyIds?.[0]
    );

    // Success!
    console.log(
      [
        `New Cosmos private key created!`,
        `- Name: ${privateKeyName}`,
        `- Private key ID: ${privateKeyId}`,
        ``,
        "Now you can take the private key ID, put it in `.env.local`, then re-run the script.",
      ].join("\n")
    );
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: `Failed to create a new Cosmos private key: ${
        (error as Error).message
      }`,
      cause: error as Error,
    });
  }
}
