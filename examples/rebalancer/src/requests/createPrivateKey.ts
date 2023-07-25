import { TurnkeyApi, init as httpInit, withAsyncPolling } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function createPrivateKey(
  privateKeyName: string,
  privateKeyTags: string[]
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
    request: TurnkeyApi.postCreatePrivateKeys,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  try {
    const activity = await mutation({
      body: {
        type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
        organizationId: process.env.ORGANIZATION_ID!,
        parameters: {
          privateKeys: [
            {
              privateKeyName,
              privateKeyTags,
              curve: "CURVE_SECP256K1",
              addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
            },
          ],
        },
        timestampMs: String(Date.now()), // millisecond timestamp
      },
    });

    const privateKey = refineNonNull(
      activity.result.createPrivateKeysResultV2?.privateKeys?.[0]
    );
    const privateKeyId = refineNonNull(privateKey.privateKeyId);
    const address = refineNonNull(privateKey.addresses?.[0]?.address);

    // Success!
    console.log(
      [
        `New Ethereum private key created!`,
        `- Name: ${privateKeyName}`,
        `- Private key ID: ${privateKeyId}`,
        `- Address: ${address}`,
        ``,
      ].join("\n")
    );

    return privateKeyId;
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
