import type { Turnkey } from "@turnkey/sdk-server";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function createPrivateKeyTag(
  turnkeyClient: Turnkey,
  privateKeyTagName: string,
  privateKeyIds: string[]
): Promise<string> {
  try {
    const activity = await turnkeyClient.apiClient().createPrivateKeyTag({
      privateKeyTagName,
      privateKeyIds,
    });

    const privateKeyTagId = refineNonNull(activity?.privateKeyTagId);

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
