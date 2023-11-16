import type { TurnkeyClient } from "@turnkey/http";
import { createActivityPoller } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

export default async function createPolicy(
  turnkeyClient: TurnkeyClient,
  policyName: string,
  effect: "EFFECT_ALLOW" | "EFFECT_DENY",
  consensus: string,
  condition: string
): Promise<string> {
  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createPolicy,
  });

  try {
    const activity = await activityPoller({
      type: "ACTIVITY_TYPE_CREATE_POLICY_V3",
      organizationId: process.env.ORGANIZATION_ID!,
      parameters: {
        policyName,
        condition,
        consensus,
        effect,
        notes: "",
      },
      timestampMs: String(Date.now()), // millisecond timestamp
    });

    const policyId = refineNonNull(
      activity.result.createPolicyResult?.policyId
    );

    // Success!
    console.log(
      [
        `New policy created!`,
        `- Name: ${policyName}`,
        `- Policy ID: ${policyId}`,
        `- Effect: ${effect}`,
        `- Consensus: ${consensus}`,
        `- Condition: ${condition}`,
        ``,
      ].join("\n")
    );

    return policyId;
  } catch (error) {
    // If needed, you can read from `TurnkeyActivityError` to find out why the activity didn't succeed
    if (error instanceof TurnkeyActivityError) {
      throw error;
    }

    throw new TurnkeyActivityError({
      message: "Failed to create a new policy",
      cause: error as Error,
    });
  }
}
