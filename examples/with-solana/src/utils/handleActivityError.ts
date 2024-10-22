import prompts from "prompts";
import {
  TurnkeyActivityConsensusNeededError,
  TERMINAL_ACTIVITY_STATUSES,
  type TActivity,
} from "@turnkey/http";
import type { Turnkey } from "@turnkey/sdk-server";

export async function handleActivityError(turnkeyClient: Turnkey, error: any) {
  if (error instanceof TurnkeyActivityConsensusNeededError) {
    const activityId = error["activityId"]!;
    let activityStatus = error["activityStatus"]!;
    let activity: TActivity | undefined;

    while (!TERMINAL_ACTIVITY_STATUSES.includes(activityStatus)) {
      console.log("\nWaiting for consensus...\n");

      const { retry } = await prompts([
        {
          type: "text",
          name: "retry",
          message: "Consensus reached? y/n",
          initial: "y",
        },
      ]);

      if (retry === "n") {
        continue;
      }

      // Refresh activity
      activity = (
        await turnkeyClient.apiClient().getActivity({
          activityId,
          organizationId: process.env.ORGANIZATION_ID!,
        })
      ).activity;

      activityStatus = activity.status;
    }

    console.log("\nConsensus reached! Moving on...\n");

    return activity;
  }

  // Rethrow error
  throw error;
}
