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

  // The id of the non-root user that you'll be using to sign the Yield related transactions
  const userId = process.env.NONROOT_USER_ID!;

  //approval policy

  const approvalPolicy = {
    policyName:
      "Allow API key user to call the approve function on the USDC_ADDRESS",
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${userId}')`,
    condition: `eth.tx.to == '${process.env.USDC_ADDRESS}' && eth.tx.data[0..10] == '0x095ea7b3'`,
    notes: "",
  };

  const { policyId: approvalPolicyId } =
    await turnkeyClient.createPolicy(approvalPolicy);

  console.log(
    [
      `Created approval policy:`,
      `- Name: ${approvalPolicy.policyName}`,
      `- Policy ID: ${approvalPolicyId}`,
      `- Effect: ${approvalPolicy.effect}`,
      `- Consensus: ${approvalPolicy.consensus}`,
      `- Condition: ${approvalPolicy.condition}`,
      ``,
    ].join("\n"),
  );

  //deposit policy

  const depositPolicy = {
    policyName:
      "Allow API key user to call the deposit function on the gtUSDCf_VAULT_ADDRESS",
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${userId}')`,
    condition: `eth.tx.to == '${process.env.gtUSDCf_VAULT_ADDRESS}' && eth.tx.data[0..10] == '0x6e553f65'`,
    notes: "",
  };

  const { policyId: depositPolicyId } =
    await turnkeyClient.createPolicy(depositPolicy);

  console.log(
    [
      `Created deposit policy:`,
      `- Name: ${depositPolicy.policyName}`,
      `- Policy ID: ${depositPolicyId}`,
      `- Effect: ${depositPolicy.effect}`,
      `- Consensus: ${depositPolicy.consensus}`,
      `- Condition: ${depositPolicy.condition}`,
      ``,
    ].join("\n"),
  );

  //withdraw policy

  const withdrawPolicy = {
    policyName:
      "Allow API key user to call the withdraw function on the gtUSDCf_VAULT_ADDRESS",
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${userId}')`,
    condition: `eth.tx.to == '${process.env.gtUSDCf_VAULT_ADDRESS}' && eth.tx.data[0..10] == '0xba087652'`,
    notes: "",
  };

  const { policyId: withdrawPolicyId } =
    await turnkeyClient.createPolicy(withdrawPolicy);

  console.log(
    [
      `Created withdraw policy:`,
      `- Name: ${withdrawPolicy.policyName}`,
      `- Policy ID: ${withdrawPolicyId}`,
      `- Effect: ${withdrawPolicy.effect}`,
      `- Consensus: ${withdrawPolicy.consensus}`,
      `- Condition: ${withdrawPolicy.condition}`,
      ``,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
