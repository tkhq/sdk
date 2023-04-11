import {
  PublicApiService,
  init as httpInit,
  withAsyncPolling,
} from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import * as crypto from "crypto";

export async function createNewEthereumPrivateKey() {
  // Initialize `@turnkey/http` with your credentials
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  console.log(
    "`process.env.PRIVATE_KEY_ID` not found; creating a new Ethereum private key on Turnkey...\n"
  );

  // Use `withAsyncPolling` to handle async activity polling.
  // In this example, it polls every 250ms until the activity reaches a terminal state.
  const mutation = withAsyncPolling({
    request: PublicApiService.postCreatePrivateKeys,
    refreshIntervalMs: 250,
  });

  const privateKeyName = `ETH Key ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const activity = await mutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS",
        organizationId: process.env.ORGANIZATION_ID!,
        parameters: {
          privateKeys: [
            {
              privateKeyName,
              curve: "CURVE_SECP256K1",
              addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
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
        `New Ethereum private key created!`,
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
      message: "Failed to create a new Ethereum private key",
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
