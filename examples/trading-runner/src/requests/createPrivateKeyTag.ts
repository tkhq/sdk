import {
  type TurnkeyServerClient,
  TurnkeyActivityError,
} from "@turnkey/sdk-server";
import { refineNonNull } from "./utils";

export default async function createPrivateKeyTag(
  turnkeyClient: TurnkeyServerClient,
  privateKeyTagName: string,
  privateKeyIds: string[]
): Promise<string> {
  try {
    const { privateKeyTagId } = await turnkeyClient.createPrivateKeyTag({
      privateKeyTagName,
      privateKeyIds,
    });

    const newPrivateKeyTagId = refineNonNull(privateKeyTagId);

    // Success!
    console.log(
      [
        `New private key tag created!`,
        `- Name: ${privateKeyTagName}`,
        `- Private key tag ID: ${newPrivateKeyTagId}`,
        ``,
      ].join("\n")
    );

    return newPrivateKeyTagId;
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
