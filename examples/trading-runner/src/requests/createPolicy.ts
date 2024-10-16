import {
  type TurnkeyServerClient,
  TurnkeyActivityError,
} from "@turnkey/sdk-server";

import { refineNonNull } from "./utils";

export default async function createPolicy(
  turnkeyClient: TurnkeyServerClient,
  policyName: string,
  effect: "EFFECT_ALLOW" | "EFFECT_DENY",
  consensus: string,
  condition: string
): Promise<string> {
  try {
    const { policyId } = await turnkeyClient.apiClient().createPolicy({
      policyName,
      condition,
      consensus,
      effect,
      notes: "",
    });

    const newPolicyId = refineNonNull(policyId);

    // Success!
    console.log(
      [
        `New policy created!`,
        `- Name: ${policyName}`,
        `- Policy ID: ${newPolicyId}`,
        `- Effect: ${effect}`,
        `- Consensus: ${consensus}`,
        `- Condition: ${condition}`,
        ``,
      ].join("\n")
    );

    return newPolicyId;
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
