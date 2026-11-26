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

/**
 * The backend API key stays a (non-root) user of the sub-organization after handoff,
 * so Turnkey evaluates its policies when it stamps oauth_login — unlike with-x, where
 * the parent key is not a member and oauth_login is authorized by the OIDC token alone.
 * Without this allow, the backend's session mint for the claimant is implicitly denied
 * the moment updateRootQuorum demotes it. Like the deny above it is latent while the
 * backend is root and becomes live at handoff.
 *
 * Trust note: this lets the backend mint a claimant session, which is the same trust
 * every backend-mediated OAuth flow carries (the backend relays the client's public
 * key). It requires a fresh X OIDC token, so it is only possible during a genuine
 * claimant login, and it grants no signing ability: the deny above still applies.
 */
export const BACKEND_OAUTH_LOGIN_ALLOW = {
  policyName: "Allow allocation backend to mint claimant sessions",
  effect: "EFFECT_ALLOW" as const,
  condition: "activity.type == 'ACTIVITY_TYPE_OAUTH_LOGIN'",
  consensus: "approvers.any(user, user.id == 'BACKEND_USER_ID')",
  notes: "Replace BACKEND_USER_ID. Needed for oauth_login after the backend leaves root quorum.",
};

export function backendOauthLoginAllowPolicy(backendUserId: string) {
  return {
    ...BACKEND_OAUTH_LOGIN_ALLOW,
    consensus: `approvers.any(user, user.id == '${backendUserId}')`,
  };
}

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
