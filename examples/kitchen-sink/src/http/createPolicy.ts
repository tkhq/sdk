import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { TurnkeyClient, createActivityPoller } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import { refineNonNull } from "../utils";

async function main() {
  // Initialize a Turnkey client
  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const activityPoller = createActivityPoller({
    client: turnkeyClient,
    requestFn: turnkeyClient.createPolicy,
  });

  const policyName = "<your new policy name";
  const effect = "EFFECT_ALLOW"; // "EFFECT_ALLOW" | "EFFECT_DENY"
  const consensus = ""; // desired consensus. See https://docs.turnkey.com/concepts/policies/overview
  const condition = ""; // desired condition. See https://docs.turnkey.com/concepts/policies/overview
  const notes = "";

  const activity = await activityPoller({
    type: "ACTIVITY_TYPE_CREATE_POLICY_V3",
    organizationId: process.env.ORGANIZATION_ID!,
    parameters: {
      policyName,
      condition,
      consensus,
      effect,
      notes,
    },
    timestampMs: String(Date.now()), // millisecond timestamp
  });

  const policyId = refineNonNull(activity.result.createPolicyResult?.policyId);

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
