import { TurnkeyApi, init as httpInit, withAsyncPolling } from "@turnkey/http";
import { TurnkeyActivityError } from "@turnkey/ethers";
import { refineNonNull } from "./utils";

// TODO(tim): refine w/ options
export default async function createPolicy(policyName: string, effect: string, consensus: string, condition: string): string {
  // Initialize `@turnkey/http` with your credentials
  httpInit({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    baseUrl: process.env.BASE_URL!,
  });

  // Use `withAsyncPolling` to handle async activity polling.
  // In this example, it polls every 250ms until the activity reaches a terminal state.
  const mutation = withAsyncPolling({
    request: TurnkeyApi.postCreatePrivateKeys,
    refreshIntervalMs: 250, // defaults to 500ms
  });

  try {
    const activity = await mutation({
      body: {
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
      },
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
