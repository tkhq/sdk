/**
 * Composable policy template builders for @turnkey/agent-auth.
 *
 * Each template returns an AgentPolicyParams with:
 * - EFFECT_ALLOW (never DENY, implicit deny handles the rest)
 * - <AGENT_USER_ID> placeholder in consensus (resolved by createAgentSession)
 * - Typed options for common restrictions
 *
 * Chain-specific conditions (eth.tx.*, solana.tx.*) produce MissingKeyword
 * errors when evaluated against non-matching activity types. The UMP evaluator
 * treats these as Outcome::Error (functionally equivalent to "does not match").
 * This is safe by design.
 */

import type { AgentPolicyParams } from "./types";

const AGENT_CONSENSUS = "approvers.any(user, user.id == '<AGENT_USER_ID>')";

// ---------------------------------------------------------------------------
// Signing Policies
// ---------------------------------------------------------------------------

/**
 * Allow batch signing (sign_raw_payloads).
 */
export function allowSignRawPayloads(): AgentPolicyParams {
  return {
    policyName: "allow-sign-raw-payloads",
    effect: "EFFECT_ALLOW",
    condition: "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOADS'",
    consensus: AGENT_CONSENSUS,
  };
}

/**
 * Allow all signing operations: sign_raw_payload, sign_transaction, and sign_raw_payloads.
 * Uses the `in` operator (not `||`) because UMP does not short-circuit logical operators.
 */
export function allowAllSigning(): AgentPolicyParams {
  return {
    policyName: "allow-all-signing",
    effect: "EFFECT_ALLOW",
    condition:
      "activity.type in ['ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2', 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2', 'ACTIVITY_TYPE_SIGN_RAW_PAYLOADS']",
    consensus: AGENT_CONSENSUS,
  };
}

// ---------------------------------------------------------------------------
// Ethereum Policies
// ---------------------------------------------------------------------------

/**
 * Allow Ethereum transactions with optional restrictions.
 *
 * @param opts.chainIds - Restrict to specific chain IDs (e.g., [1, 137])
 * @param opts.maxValue - Max transaction value in wei (as string for big numbers)
 * @param opts.allowedAddresses - Restrict destination addresses (auto-lowercased)
 * @param opts.walletId - Restrict to a specific wallet
 */
export function allowEthTransaction(opts?: {
  chainIds?: number[];
  maxValue?: string;
  allowedAddresses?: string[];
  walletId?: string;
}): AgentPolicyParams {
  const conditions: string[] = [
    "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
  ];

  if (opts?.chainIds?.length) {
    conditions.push(`eth.tx.chain_id in [${opts.chainIds.join(", ")}]`);
  }
  if (opts?.maxValue !== undefined) {
    conditions.push(`eth.tx.value <= ${opts.maxValue}`);
  }
  if (opts?.allowedAddresses?.length) {
    const addrs = opts.allowedAddresses
      .map((a) => `'${a.toLowerCase()}'`)
      .join(", ");
    conditions.push(`eth.tx.to in [${addrs}]`);
  }
  if (opts?.walletId) {
    conditions.push(`wallet.id == '${opts.walletId}'`);
  }

  return {
    policyName: "allow-eth-transaction",
    effect: "EFFECT_ALLOW",
    condition: conditions.join(" && "),
    consensus: AGENT_CONSENSUS,
  };
}

/**
 * Allow ERC-20 token transfers.
 * Detects the `transfer(address,uint256)` function selector (0xa9059cbb).
 *
 * @param opts.tokenAddress - ERC-20 contract address (auto-lowercased)
 * @param opts.allowedRecipients - Restrict transfer recipients
 * @param opts.chainIds - Restrict to specific chains
 */
export function allowErc20Transfer(opts: {
  tokenAddress: string;
  allowedRecipients?: string[];
  chainIds?: number[];
}): AgentPolicyParams {
  const conditions: string[] = [
    "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
    `eth.tx.to == '${opts.tokenAddress.toLowerCase()}'`,
    "eth.tx.data[0..10] == '0xa9059cbb'",
  ];

  if (opts.allowedRecipients?.length) {
    // ERC-20 transfer recipient is the first argument in calldata
    const recipients = opts.allowedRecipients
      .map((a) => `'${a.toLowerCase()}'`)
      .join(", ");
    conditions.push(`eth.tx.contract_call_args['to'] in [${recipients}]`);
  }
  if (opts.chainIds?.length) {
    conditions.push(`eth.tx.chain_id in [${opts.chainIds.join(", ")}]`);
  }

  return {
    policyName: "allow-erc20-transfer",
    effect: "EFFECT_ALLOW",
    condition: conditions.join(" && "),
    consensus: AGENT_CONSENSUS,
  };
}

/**
 * Allow EIP-712 typed data signing with optional domain/type restrictions.
 *
 * @param opts.domainName - Restrict to a specific dApp domain name
 * @param opts.primaryType - Restrict to a specific primary type
 */
export function allowEip712Signing(opts?: {
  domainName?: string;
  primaryType?: string;
}): AgentPolicyParams {
  const conditions: string[] = [
    "activity.type == 'ACTIVITY_TYPE_SIGN_RAW_PAYLOAD_V2'",
  ];

  if (opts?.domainName) {
    conditions.push(`eth.eip_712.domain.name == '${opts.domainName}'`);
  }
  if (opts?.primaryType) {
    conditions.push(`eth.eip_712.primary_type == '${opts.primaryType}'`);
  }

  return {
    policyName: "allow-eip712-signing",
    effect: "EFFECT_ALLOW",
    condition: conditions.join(" && "),
    consensus: AGENT_CONSENSUS,
  };
}

// ---------------------------------------------------------------------------
// Solana Policies
// ---------------------------------------------------------------------------

/**
 * Allow native SOL transfers with optional recipient restrictions.
 *
 * @param opts.allowedRecipients - Restrict transfer destinations (case-sensitive for Solana)
 */
export function allowSolTransfer(opts?: {
  allowedRecipients?: string[];
}): AgentPolicyParams {
  const conditions: string[] = [
    "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
  ];

  if (opts?.allowedRecipients?.length) {
    const recipients = opts.allowedRecipients.map((a) => `'${a}'`).join(", ");
    conditions.push(`solana.tx.transfers.all(t, t.to in [${recipients}])`);
  }

  return {
    policyName: "allow-sol-transfer",
    effect: "EFFECT_ALLOW",
    condition: conditions.join(" && "),
    consensus: AGENT_CONSENSUS,
  };
}

/**
 * Allow SPL token transfers with optional token and recipient restrictions.
 *
 * @param opts.tokenMint - Restrict to a specific token mint address (case-sensitive)
 * @param opts.allowedRecipients - Restrict transfer destinations (case-sensitive)
 */
export function allowSplTransfer(opts?: {
  tokenMint?: string;
  allowedRecipients?: string[];
}): AgentPolicyParams {
  const conditions: string[] = [
    "activity.type == 'ACTIVITY_TYPE_SIGN_TRANSACTION_V2'",
  ];

  if (opts?.tokenMint) {
    conditions.push(
      `solana.tx.spl_transfers.all(t, t.token_mint == '${opts.tokenMint}')`,
    );
  }
  if (opts?.allowedRecipients?.length) {
    const recipients = opts.allowedRecipients.map((a) => `'${a}'`).join(", ");
    conditions.push(`solana.tx.spl_transfers.all(t, t.to in [${recipients}])`);
  }

  return {
    policyName: "allow-spl-transfer",
    effect: "EFFECT_ALLOW",
    condition: conditions.join(" && "),
    consensus: AGENT_CONSENSUS,
  };
}

// ---------------------------------------------------------------------------
// Wallet & Key Management Policies
// ---------------------------------------------------------------------------

/**
 * Allow exporting wallet account keys via HPKE.
 */
export function allowExportWalletAccount(): AgentPolicyParams {
  return {
    policyName: "allow-export-wallet-account",
    effect: "EFFECT_ALLOW",
    condition: "activity.type == 'ACTIVITY_TYPE_EXPORT_WALLET_ACCOUNT'",
    consensus: AGENT_CONSENSUS,
  };
}

/**
 * Allow creating new accounts in an existing wallet.
 */
export function allowCreateWalletAccounts(): AgentPolicyParams {
  return {
    policyName: "allow-create-wallet-accounts",
    effect: "EFFECT_ALLOW",
    condition: "activity.type == 'ACTIVITY_TYPE_CREATE_WALLET_ACCOUNTS'",
    consensus: AGENT_CONSENSUS,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Combine multiple condition strings into a single AND expression.
 * Useful for building custom policies from reusable condition fragments.
 */
export function combineConditions(conditions: string[]): string {
  if (conditions.length === 0) {
    throw new Error("combineConditions requires at least one condition");
  }
  return conditions.join(" && ");
}
