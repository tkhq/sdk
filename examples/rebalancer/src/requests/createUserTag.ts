import type { Turnkey } from "@turnkey/sdk-server";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function createUserTag(
  turnkeyClient: Turnkey,
  userTagName: string,
  userIds: string[]
): Promise<string> {
  try {
    const activity = await turnkeyClient.apiClient().createUserTag({
      userTagName,
      userIds,
    });

    const userTagId = refineNonNull(activity?.userTagId);

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
