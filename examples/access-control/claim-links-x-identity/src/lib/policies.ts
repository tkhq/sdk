/**
 * Reusable policy documents for the X allocation lifecycle.
 * See the Delegated Access pattern:
 * https://docs.turnkey.com/features/policies/delegated-access/overview
 * The sibling ../claim-links-delegated-reclaim example demonstrates the
 * two-root variant, where a bootstrap key installs policy and self-demotes.
 *
 * Turnkey root users bypass every policy. PRECLAIM_BACKEND_SIGN_DENY is
 * therefore a latent guard while the backend is the sole root and becomes
 * enforceable only when claim removes that user from root quorum. It is kept
 * explicit (rather than relying only on absence of an allow) so an accidental
 * future broad allow still cannot authorize the old backend credential.
 */
export const PRECLAIM_BACKEND_SIGN_DENY = {
  policyName: "Deny allocation backend signing after handoff",
  effect: "EFFECT_DENY" as const,
  condition: "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'",
  consensus: "approvers.any(user, user.id == 'BACKEND_USER_ID')",
  notes: "Replace BACKEND_USER_ID. Effective after that user leaves root quorum.",
};

/**
 * Installed at claim time because the policy language does not expose a stable
 * predicate for “user authenticated by X”. Binding the allow to the newly
 * attached claimant user ID is narrower and auditable, but production must
 * deliberately replace it if account recovery creates a successor user.
 */
export const CLAIMANT_SIGN_ALLOW = {
  policyName: "Allow the bound X claimant to sign",
  effect: "EFFECT_ALLOW" as const,
  condition: "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'",
  consensus: "approvers.any(user, user.id == 'CLAIMANT_USER_ID')",
  notes: "Replace CLAIMANT_USER_ID with the user created for the verified X subject.",
};

export function backendSignDenyPolicy(backendUserId: string) {
  return {
    ...PRECLAIM_BACKEND_SIGN_DENY,
    consensus: `approvers.any(user, user.id == '${backendUserId}')`,
  };
}

export function claimantSignAllowPolicy(claimantUserId: string) {
  return {
    ...CLAIMANT_SIGN_ALLOW,
    consensus: `approvers.any(user, user.id == '${claimantUserId}')`,
  };
}
