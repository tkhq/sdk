import { Turnkey } from "@turnkey/sdk-server";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  }).apiClient();

  // The id of the non-root user that you'll be using to sign the Morpho related transactions
  const userId = process.env.NONROOT_USER_ID!;

  const policyName =
    "Allow API key user to only call the MORPHO_VAULT_ADDRESS and USDC_ADDRESS";
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.any(user, user.id == '${userId}')`;
  const condition = `eth.tx.to in ['${process.env.USDC_ADDRESS}', '${process.env.MORPHO_VAULT_ADDRESS}']`;
  const notes = "";

  const { policyId } = await turnkeyClient.createPolicy({
    policyName,
    condition,
    consensus,
    effect,
    notes,
  });

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
