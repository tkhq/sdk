import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

import { refineNonNull } from "../utils";

async function main() {
  // Initialize a Turnkey client
  const turnkeyClient = new TurnkeySDKServer({
    apiBaseUrl: "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const policyName = "<your new policy name";
  const effect = "EFFECT_ALLOW"; // "EFFECT_ALLOW" | "EFFECT_DENY"
  const consensus = ""; // desired consensus. See https://docs.turnkey.com/concepts/policies/overview
  const condition = ""; // desired condition. See https://docs.turnkey.com/concepts/policies/overview
  const notes = "";

  const { policyId } = await turnkeyClient.apiClient().createPolicy({
    policyName,
    condition,
    consensus,
    effect,
    notes,
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
