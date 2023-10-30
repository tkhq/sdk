import { TurnkeyClient } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http/dist/async";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import { TurnkeyActivityError } from "@turnkey/ethers";
import * as crypto from "crypto";
import { refineNonNull } from "./util";

export async function createNewEthereumPrivateKey() {
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createPrivateKeys,
  });

  const privateKeyName = `ETH Key ${crypto.randomBytes(2).toString("hex")}`;

  try {
    const activity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_PRIVATE_KEYS_V2",
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
    });

    const privateKeys = refineNonNull(
      activity.result.createPrivateKeysResultV2?.privateKeys
    );
    const privateKeyId = refineNonNull(privateKeys?.[0]?.privateKeyId);
    const address = refineNonNull(privateKeys?.[0]?.addresses?.[0]?.address);

    // Success!
    console.log(
      [
        `New Ethereum private key created!`,
        `- Name: ${privateKeyName}`,
        `- Private key ID: ${privateKeyId}`,
        `- Address: ${address}`,
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
