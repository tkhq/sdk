import type { TurnkeyClient } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function approveActivity(
  turnkeyClient: TurnkeyClient,
  activityId: string,
  activityFingerprint: string
): Promise<string> {
  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.approveActivity,
  });

  try {
    const activity = await activityPoller({
      type: "ACTIVITY_TYPE_APPROVE_ACTIVITY",
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        fingerprint: activityFingerprint,
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const result = refineNonNull(activity);

    // Success!
    console.log(
      [`✅ Approved activity!`, `- Activity ID: ${result.id}`, ``].join("\n")
    );

    return activityId;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to approve activity",
      cause: error as Error,
    });
  }
}
