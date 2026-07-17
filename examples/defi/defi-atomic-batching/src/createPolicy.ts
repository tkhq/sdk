import { turnkeyClient, signWith } from "./util";

/**
 * Showcase the policy engine on the batch path: allow a NON-ROOT user to
 * submit ETH_SEND_TRANSACTION_V2 activities from this wallet — and nothing
 * else. One policy evaluation covers the entire batch of calls.
 *
 * Run this with ROOT credentials in .env.local, then hand the non-root
 * user's API keys to whatever service should be allowed to press the button.
 */
async function main() {
  const client = turnkeyClient();

  // The id of the non-root user that will submit the batches
  const userId = process.env.NONROOT_USER_ID!;

  const policyName = "Allow non-root user to submit sponsored V2 batches from the treasury";
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.any(user, user.id == '${userId}')`;
  const condition = [
    `activity.type == 'ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2'`,
    `eth.tx.from == '${signWith().toLowerCase()}'`,
  ].join(" && ");

  const { policyId } = await client.createPolicy({
    policyName,
    condition,
    consensus,
    effect,
    notes: "",
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
