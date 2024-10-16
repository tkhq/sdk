import {
  type TurnkeyServerClient,
  TurnkeyActivityError,
} from "@turnkey/sdk-server";
import { refineNonNull } from "./utils";

export default async function createPrivateKey(
  turnkeyClient: TurnkeyServerClient,
  privateKeyName: string,
  privateKeyTags: string[]
): Promise<string> {
  console.log("creating a new Ethereum private key on Turnkey...\n");

  try {
    const { privateKeys } = await turnkeyClient.apiClient().createPrivateKeys({
      privateKeys: [
        {
          privateKeyName,
          privateKeyTags,
          curve: "CURVE_SECP256K1",
          addressFormats: ["ADDRESS_FORMAT_ETHEREUM"],
        },
      ],
    });

    const newPrivateKeys = refineNonNull(privateKeys);
    const privateKeyId = refineNonNull(newPrivateKeys?.[0]?.privateKeyId);
    const address = refineNonNull(newPrivateKeys?.[0]?.addresses?.[0]?.address);

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
