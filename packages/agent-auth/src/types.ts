/**
 * Configuration for a wallet account to be created for the agent.
 * Use presets from `./presets` for common configurations, or specify custom curve/path combos.
 */
export interface AgentAccountConfig {
  /** Human-readable label for this account (e.g. "git-signing", "jwt-signing") */
  label: string;
  /** Cryptographic curve: "CURVE_ED25519", "CURVE_P256", "CURVE_SECP256K1", etc. */
  curve: string;
  /** Path format. Defaults to "PATH_FORMAT_BIP32" */
  pathFormat?: string;
  /** Derivation path. Defaults based on curve if not specified */
  path?: string;
  /** Address format. Defaults based on curve if not specified */
  addressFormat?: string;
  /** If true, the private key will be exported via HPKE and returned in the result */
  exportKey?: boolean;
}

/**
 * Policy to attach to the agent's sub-organization.
 * Only ALLOW policies should be used. Implicit deny handles everything else.
 * DenyExplicit has absolute precedence and will block even matching ALLOW policies.
 */
export interface AgentPolicyParams {
  policyName: string;
  /** Must be "EFFECT_ALLOW". Avoid "EFFECT_DENY" due to absolute precedence. */
  effect: string;
  /** CEL condition expression (e.g. "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'") */
  condition?: string;
  /**
   * CEL consensus expression scoping which users this policy applies to.
   * Use <AGENT_USER_ID> as a placeholder; it will be replaced with the actual agent user ID.
   */
  consensus?: string;
}

export interface CreateAgentSessionRequest {
  /** Parent organization ID */
  organizationId: string;
  /** Human-readable name for the agent (used as sub-org and user name) */
  agentName: string;
  /** TTL in seconds for the agent's API key */
  expirationSeconds: number;
  /** Wallet accounts to create. Use presets or custom AgentAccountConfig objects. */
  accounts?: AgentAccountConfig[];
  /** Additional ALLOW policies beyond the default sign_raw_payload policy */
  policies?: AgentPolicyParams[];
}

export interface AgentAccountResult {
  label: string;
  publicKey: string;
  /** HPKE-encrypted private key bundle (only present if exportKey was true) */
  exportBundle?: string;
  walletId: string;
  addressId: string;
  curve: string;
}

export interface CreateAgentSessionResult {
  /** The agent's isolated sub-organization ID */
  subOrganizationId: string;
  /** The non-root agent user ID */
  agentUserId: string;
  /** The agent's API key credentials (returned once, caller must secure them) */
  apiKey: {
    publicKey: string;
    privateKey: string;
  };
  /**
   * The root admin API key for this sub-org (orchestrator-only, do not share with agent).
   * Required to delete the agent session via deleteAgentSession().
   */
  adminApiKey: {
    publicKey: string;
    privateKey: string;
  };
  /** Created wallet accounts with public keys and optional export bundles */
  accounts: AgentAccountResult[];
  /** IDs of created policies */
  policyIds: string[];
  /** ISO 8601 expiry timestamp (advisory, based on expirationSeconds from request) */
  expiresAt: string;
}

export interface DeleteAgentSessionRequest {
  /** Parent organization ID */
  organizationId: string;
  /** Sub-organization ID of the agent session to delete */
  subOrganizationId: string;
  /** Admin API key for the sub-org (from CreateAgentSessionResult.adminApiKey) */
  adminApiKey: {
    publicKey: string;
    privateKey: string;
  };
}

export interface DeleteAgentSessionResult {
  subOrganizationId: string;
}
