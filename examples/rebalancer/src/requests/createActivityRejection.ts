import type { Turnkey } from "@turnkey/sdk-server";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function rejectActivity(
  turnkeyClient: Turnkey,
  activityId: string,
  activityFingerprint: string
): Promise<string> {
  try {
    const response = await turnkeyClient.apiClient().rejectActivity({
      fingerprint: activityFingerprint,
    });

    const result = refineNonNull(response);

    // Success!
    console.log(
      [
        `❌ Rejected activity!`,
        `- Activity ID: ${result.activity.id}`,
        ``,
      ].join("\n")
    );

    return activityId;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to reject activity",
      cause: error as Error,
    });
  }
}
