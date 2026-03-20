import type { AgentPolicyParams } from "./types";

const AGENT_USER_ID_PLACEHOLDER = "<AGENT_USER_ID>";

/**
 * Default policy: allow sign_raw_payload scoped to the agent user.
 * This is the minimum policy most agents need for signing operations.
 */
export function defaultSigningPolicy(
  agentUserId: string
): AgentPolicyParams {
  return {
    policyName: "allow-sign-raw-payload",
    effect: "EFFECT_ALLOW",
    condition: "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'",
    consensus: `approvers.any(user, user.id == '${agentUserId}')`,
  };
}

/**
 * Allow sign_transaction scoped to the agent user.
 * Use for agents that need to sign blockchain transactions.
 */
export function signTransactionPolicy(
  agentUserId: string
): AgentPolicyParams {
  return {
    policyName: "allow-sign-transaction",
    effect: "EFFECT_ALLOW",
    condition: "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
    consensus: `approvers.any(user, user.id == '${agentUserId}')`,
  };
}

/**
 * Replace the <AGENT_USER_ID> placeholder in policy consensus expressions
 * with the actual agent user ID.
 */
export function resolvePolicyPlaceholders(
  policies: AgentPolicyParams[],
  agentUserId: string
): AgentPolicyParams[] {
  return policies.map((policy) => {
    if (policy.consensus === undefined) {
      return policy;
    }
    return {
      ...policy,
      consensus: policy.consensus.replaceAll(
        AGENT_USER_ID_PLACEHOLDER,
        agentUserId
      ),
    };
  });
}
