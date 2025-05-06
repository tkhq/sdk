import {
  type TurnkeyServerClient,
  TurnkeyActivityError,
} from "@turnkey/sdk-server";

export default async function createPolicy(
  turnkeyClient: TurnkeyServerClient,
  policyName: string,
  effect: "EFFECT_ALLOW" | "EFFECT_DENY",
  consensus: string,
  condition: string,
  notes: string,
): Promise<string> {
  try {
    const { policyId } = await turnkeyClient.createPolicy({
      policyName,
      condition,
      consensus,
      effect,
      notes,
    });

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
      ].join("\n"),
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
