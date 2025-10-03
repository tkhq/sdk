// Policy utilities for Turnkey gas station restrictions

/**
 * Build a Turnkey policy to restrict what EIP-712 intents an EOA can sign
 * This protects at the signing layer - EOA cannot create signatures outside policy
 *
 * @param config - Policy configuration
 * @param config.organizationId - Turnkey organization ID
 * @param config.eoaUserId - Turnkey user ID for the EOA
 * @param config.restrictions - Signing restrictions
 * @param config.restrictions.allowedContracts - Whitelist of contract addresses EOA can sign intents for
 * @param config.restrictions.maxEthAmount - Maximum ETH value allowed in signed intents
 * @param config.policyName - Optional policy name
 * @returns Policy object ready to submit to Turnkey createPolicy API
 *
 * @example
 * ```typescript
 * const policy = buildIntentSigningPolicy({
 *   organizationId: "org-123",
 *   eoaUserId: "user-456",
 *   restrictions: {
 *     allowedContracts: [USDC_ADDRESS, DAI_ADDRESS],
 *     maxEthAmount: parseEther("0.01"),
 *   },
 *   policyName: "Stablecoin Only",
 * });
 *
 * await turnkeyClient.apiClient().createPolicy(policy);
 * ```
 */
export function buildIntentSigningPolicy(config: {
  organizationId: string;
  eoaUserId: string;
  restrictions: {
    allowedContracts?: `0x${string}`[];
    maxEthAmount?: bigint;
  };
  policyName?: string;
}) {
  const conditions: string[] = [
    "activity.resource == 'PRIVATE_KEY'",
    "activity.action == 'SIGN'",
    "eth.eip_712.primary_type == 'Execution'",
  ];

  if (
    config.restrictions?.allowedContracts &&
    config.restrictions.allowedContracts.length > 0
  ) {
    // Build OR conditions for each allowed contract
    // Convert to lowercase for case-insensitive comparison
    const contractConditions = config.restrictions.allowedContracts
      .map(
        (c) => `eth.eip_712.message['outputContract'] == '${c.toLowerCase()}'`
      )
      .join(" || ");
    conditions.push(`(${contractConditions})`);
  }

  if (config.restrictions?.maxEthAmount !== undefined) {
    conditions.push(
      `eth.eip_712.message['ethAmount'] <= ${config.restrictions.maxEthAmount}`
    );
  }

  return {
    organizationId: config.organizationId,
    policyName: config.policyName || "Gas Station Intent Signing Policy",
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${config.eoaUserId}')`,
    condition: conditions.join(" && "),
    notes:
      "Restricts which EIP-712 intents the EOA can sign for gas station execution",
  };
}

/**
 * Build a Turnkey policy to restrict what the paymaster can execute on-chain
 * This protects at the execution layer - paymaster cannot submit transactions outside policy
 *
 * The policy parses the packed bytes encoding used by execute(bytes data) and executeNoValue(bytes data)
 *
 * @param config - Policy configuration
 * @param config.organizationId - Turnkey organization ID
 * @param config.paymasterUserId - Turnkey user ID for the paymaster
 * @param config.executionContractAddress - Gas station execution contract address
 * @param config.restrictions - Execution restrictions
 * @param config.restrictions.allowedEOAs - Whitelist of EOA addresses paymaster can execute for
 * @param config.restrictions.allowedContracts - Whitelist of output contract addresses
 * @param config.restrictions.maxGasPrice - Maximum gas price in wei
 * @param config.restrictions.maxGasLimit - Maximum gas limit
 * @param config.policyName - Optional policy name
 * @returns Policy object ready to submit to Turnkey createPolicy API
 *
 * @example
 * ```typescript
 * const policy = buildPaymasterExecutionPolicy({
 *   organizationId: "org-paymaster",
 *   paymasterUserId: "paymaster-user-123",
 *   executionContractAddress: "0x576A4D741b96996cc93B4919a04c16545734481f",
 *   restrictions: {
 *     allowedEOAs: ["0xAlice...", "0xBob..."],
 *     allowedContracts: [USDC_ADDRESS, DAI_ADDRESS],
 *     maxGasPrice: parseGwei("50"),
 *     maxGasLimit: 500000n,
 *   },
 *   policyName: "Paymaster Protection",
 * });
 *
 * await turnkeyClient.apiClient().createPolicy(policy);
 * ```
 */
export function buildPaymasterExecutionPolicy(config: {
  organizationId: string;
  paymasterUserId: string;
  executionContractAddress: `0x${string}`;
  restrictions?: {
    allowedEOAs?: `0x${string}`[];
    allowedContracts?: `0x${string}`[];
    maxGasPrice?: bigint;
    maxGasLimit?: bigint;
  };
  policyName?: string;
}) {
  const conditions: string[] = [
    "activity.resource == 'PRIVATE_KEY'",
    "activity.action == 'SIGN'",
    `eth.tx.to == '${config.executionContractAddress.toLowerCase()}'`,
  ];

  // Parse the packed bytes in the execute() or executeNoValue() call
  // Packed data structure (starts at byte 100 of calldata):
  //   - Signature: 65 bytes (chars 200-330)
  //   - Nonce: 16 bytes (chars 330-362)
  //   - Output Contract: 20 bytes (chars 362-402)
  //   - Call Data: variable
  //
  // NOTE: eth.tx.data includes the "0x" prefix, so add 2 to all char positions
  if (
    config.restrictions?.allowedContracts &&
    config.restrictions.allowedContracts.length > 0
  ) {
    const contracts = config.restrictions.allowedContracts
      .map((addr) => {
        // Remove 0x prefix and pad to 40 hex chars (20 bytes)
        const cleanAddr = addr.slice(2).toLowerCase().padStart(40, "0");
        // Position 362 in raw hex = position 364 in eth.tx.data (with 0x prefix)
        return `eth.tx.data[364..404] == '${cleanAddr}'`;
      })
      .join(" || ");
    conditions.push(`(${contracts})`);
  }

  // Check EOA address (passed as first parameter to execute())
  // In ABI encoding: bytes 4-35 (after 4-byte function selector)
  // NOTE: eth.tx.data includes the "0x" prefix, so add 2 to all char positions
  if (
    config.restrictions?.allowedEOAs &&
    config.restrictions.allowedEOAs.length > 0
  ) {
    const eoas = config.restrictions.allowedEOAs
      .map((addr) => {
        // Remove 0x prefix, convert to lowercase, pad to 64 hex chars (32 bytes)
        const cleanAddr = addr.slice(2).toLowerCase().padStart(64, "0");
        // Position 8 in raw hex = position 10 in eth.tx.data (with 0x prefix)
        return `eth.tx.data[10..74] == '${cleanAddr}'`;
      })
      .join(" || ");
    conditions.push(`(${eoas})`);
  }

  if (config.restrictions?.maxGasPrice !== undefined) {
    conditions.push(`eth.tx.gasPrice <= ${config.restrictions.maxGasPrice}`);
  }

  if (config.restrictions?.maxGasLimit !== undefined) {
    conditions.push(`eth.tx.gas <= ${config.restrictions.maxGasLimit}`);
  }

  return {
    organizationId: config.organizationId,
    policyName: config.policyName || "Gas Station Paymaster Execution Policy",
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${config.paymasterUserId}')`,
    condition: conditions.join(" && "),
    notes:
      "Restricts which execute() transactions the paymaster can submit on-chain",
  };
}
