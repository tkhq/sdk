// Policy utilities for Turnkey gas station restrictions

/**
 * Build a Turnkey policy to restrict what EIP-712 intents an EOA can sign
 * This protects at the signing layer - EOA cannot create signatures outside policy
 *
 * @param config - Policy configuration
 * @param config.organizationId - Turnkey organization ID
 * @param config.eoaUserId - Turnkey user ID for the EOA (primary approver)
 * @param config.additionalApprovers - Optional additional user IDs that must also approve (creates AND condition)
 * @param config.customConsensus - Optional custom consensus expression (overrides eoaUserId and additionalApprovers)
 * @param config.restrictions - Signing restrictions
 * @param config.restrictions.allowedContracts - Whitelist of contract addresses EOA can sign intents for
 * @param config.restrictions.disallowEthTransfer - Whether to disallow ETH transfers (if true, ethAmount must be 0)
 * @param config.policyName - Optional policy name
 * @returns Policy object ready to submit to Turnkey createPolicy API
 *
 * @example
 * // Simple: single user approval, token-only transfers
 * const policy = buildIntentSigningPolicy({
 *   organizationId: "org-123",
 *   eoaUserId: "user-456",
 *   restrictions: {
 *     allowedContracts: ["0x833...USDC", "0x6B1...DAI"],
 *     disallowEthTransfer: true,
 *   },
 *   policyName: "Stablecoin Only",
 * });
 *
 * // Resulting policy:
 * {
 *   organizationId: "org-123",
 *   policyName: "Stablecoin Only",
 *   effect: "EFFECT_ALLOW",
 *   consensus: "approvers.any(user, user.id == 'user-456')",
 *   condition: "activity.resource == 'PRIVATE_KEY' && activity.action == 'SIGN' && " +
 *              "eth.eip_712.primary_type == 'Execution' && " +
 *              "(eth.eip_712.message['outputContract'] == '0x833...usdc' || " +
 *              "eth.eip_712.message['outputContract'] == '0x6b1...dai') && " +
 *              "eth.eip_712.message['ethAmount'] == '0'",
 *   notes: "Restricts which EIP-712 intents the EOA can sign for gas station execution"
 * }
 *
 * @example
 * // Multi-approval: EOA AND backup user must both approve
 * const policy = buildIntentSigningPolicy({
 *   organizationId: "org-123",
 *   eoaUserId: "user-456",
 *   additionalApprovers: ["backup-user-789"],
 *   restrictions: {
 *     allowedContracts: ["0x833...USDC"],
 *     disallowEthTransfer: true,
 *   },
 * });
 *
 * // Resulting policy:
 * {
 *   organizationId: "org-123",
 *   policyName: "Gas Station Intent Signing Policy",
 *   effect: "EFFECT_ALLOW",
 *   consensus: "approvers.any(user, user.id == 'user-456') && " +
 *              "approvers.any(user, user.id == 'backup-user-789')",
 *   condition: "activity.resource == 'PRIVATE_KEY' && activity.action == 'SIGN' && " +
 *              "eth.eip_712.primary_type == 'Execution' && " +
 *              "(eth.eip_712.message['outputContract'] == '0x833...usdc') && " +
 *              "eth.eip_712.message['ethAmount'] == '0'",
 *   notes: "Restricts which EIP-712 intents the EOA can sign for gas station execution"
 * }
 *
 * @example
 * // Advanced: custom consensus expression
 * const policy = buildIntentSigningPolicy({
 *   organizationId: "org-123",
 *   eoaUserId: "user-456",
 *   customConsensus: "approvers.count() >= 2",
 *   restrictions: {
 *     disallowEthTransfer: false,
 *   },
 * });
 *
 * await turnkeyClient.apiClient().createPolicy(policy);
 */
export function buildIntentSigningPolicy(config: {
  organizationId: string;
  eoaUserId: string;
  additionalApprovers?: string[];
  customConsensus?: string;
  restrictions?: {
    allowedContracts?: `0x${string}`[];
    disallowEthTransfer?: boolean;
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
        (c) => `eth.eip_712.message['outputContract'] == '${c.toLowerCase()}'`,
      )
      .join(" || ");
    conditions.push(`(${contractConditions})`);
  }

  if (!!config.restrictions?.disallowEthTransfer) {
    conditions.push(`eth.eip_712.message['ethAmount'] == '0'`);
  }

  // Build consensus expression
  let consensus: string;
  if (config.customConsensus) {
    // Use custom consensus if provided
    consensus = config.customConsensus;
  } else if (
    config.additionalApprovers &&
    config.additionalApprovers.length > 0
  ) {
    // Build multi-user AND condition: eoaUserId AND all additionalApprovers must approve
    const approverConditions = [
      `approvers.any(user, user.id == '${config.eoaUserId}')`,
      ...config.additionalApprovers.map(
        (id) => `approvers.any(user, user.id == '${id}')`,
      ),
    ];
    consensus = approverConditions.join(" && ");
  } else {
    // Default: only eoaUserId can approve
    consensus = `approvers.any(user, user.id == '${config.eoaUserId}')`;
  }

  return {
    organizationId: config.organizationId,
    policyName: config.policyName || "Gas Station Intent Signing Policy",
    effect: "EFFECT_ALLOW" as const,
    consensus,
    condition: conditions.join(" && "),
    notes:
      "Restricts which EIP-712 intents the EOA can sign for gas station execution",
  };
}

/**
 * Build a Turnkey policy to restrict what the paymaster can execute on-chain.
 * This protects at the execution layer - paymaster cannot submit transactions outside policy.
 *
 * This function uses Turnkey's Smart Contract Interface feature to parse the
 * execute(address _targetEoA, address _to, uint256 ethAmount, bytes _data) ABI.
 * Before using this function, ensure the Gas Station ABI is uploaded via
 * ensureGasStationInterface() - this is typically handled automatically.
 *
 * @param config - Policy configuration
 * @param config.organizationId - Turnkey organization ID
 * @param config.paymasterUserId - Turnkey user ID for the paymaster (primary approver)
 * @param config.additionalApprovers - Optional additional user IDs that can approve (creates OR condition)
 * @param config.customConsensus - Optional custom consensus expression (overrides paymasterUserId and additionalApprovers)
 * @param config.executionContractAddress - Gas station execution contract address
 * @param config.restrictions - Execution restrictions
 * @param config.restrictions.allowedEOAs - Whitelist of EOA addresses paymaster can execute for
 * @param config.restrictions.allowedContracts - Whitelist of output contract addresses (target contracts)
 * @param config.restrictions.maxEthAmount - Maximum ETH amount in wei that can be transferred
 * @param config.restrictions.maxGasPrice - Maximum gas price in wei
 * @param config.restrictions.maxGasLimit - Maximum gas limit
 * @param config.policyName - Optional policy name
 * @returns Policy object ready to submit to Turnkey createPolicy API
 *
 * @example
 * // Simple: single paymaster approval with ETH amount limit
 * const policy = buildPaymasterExecutionPolicy({
 *   organizationId: "org-paymaster",
 *   paymasterUserId: "paymaster-user-123",
 *   executionContractAddress: "0x576A4D741b96996cc93B4919a04c16545734481f",
 *   restrictions: {
 *     allowedEOAs: ["0xAli...ce", "0xBob...by"],
 *     allowedContracts: ["0x833...USDC", "0x6B1...DAI"],
 *     maxEthAmount: parseEther("0.1"), // Max 0.1 ETH per transaction
 *     maxGasPrice: parseGwei("50"),
 *     maxGasLimit: 500000n,
 *   },
 *   policyName: "Paymaster Protection",
 * });
 *
 * // Resulting policy (uses ABI parsing):
 * {
 *   organizationId: "org-paymaster",
 *   policyName: "Paymaster Protection",
 *   effect: "EFFECT_ALLOW",
 *   consensus: "approvers.any(user, user.id == 'paymaster-user-123')",
 *   condition: "activity.resource == 'PRIVATE_KEY' && activity.action == 'SIGN' && " +
 *              "eth.tx.to == '0x576a...481f' && " +
 *              "(eth.tx.contract_call_args['_to'] == '0x833...usdc' || " +
 *              "eth.tx.contract_call_args['_to'] == '0x6b1...dai') && " +
 *              "(eth.tx.contract_call_args['_targetEoA'] == '0xali...ce' || " +
 *              "eth.tx.contract_call_args['_targetEoA'] == '0xbob...by') && " +
 *              "eth.tx.contract_call_args['ethAmount'] <= 100000000000000000 && " +
 *              "eth.tx.gasPrice <= 50000000000 && eth.tx.gas <= 500000",
 *   notes: "Restricts which execute() transactions the paymaster can submit on-chain"
 * }
 *
 * @example
 * // Multi-user: primary paymaster OR backup can approve
 * const policy = buildPaymasterExecutionPolicy({
 *   organizationId: "org-paymaster",
 *   paymasterUserId: "paymaster-user-123",
 *   additionalApprovers: ["backup-paymaster-456"],
 *   executionContractAddress: "0x576A4D741b96996cc93B4919a04c16545734481f",
 *   restrictions: {
 *     allowedEOAs: ["0xAli...ce"],
 *     maxEthAmount: parseEther("1"), // Max 1 ETH
 *     maxGasPrice: parseGwei("100"),
 *   },
 * });
 *
 * // Resulting policy (uses ABI parsing):
 * {
 *   organizationId: "org-paymaster",
 *   policyName: "Gas Station Paymaster Execution Policy",
 *   effect: "EFFECT_ALLOW",
 *   consensus: "approvers.any(user, user.id == 'paymaster-user-123' || " +
 *              "user.id == 'backup-paymaster-456')",
 *   condition: "activity.resource == 'PRIVATE_KEY' && activity.action == 'SIGN' && " +
 *              "eth.tx.to == '0x576a...481f' && " +
 *              "(eth.tx.contract_call_args['_targetEoA'] == '0xali...ce') && " +
 *              "eth.tx.contract_call_args['ethAmount'] <= 1000000000000000000 && " +
 *              "eth.tx.gasPrice <= 100000000000",
 *   notes: "Restricts which execute() transactions the paymaster can submit on-chain"
 * }
 *
 * @example
 * // Advanced: require multiple approvals
 * const policy = buildPaymasterExecutionPolicy({
 *   organizationId: "org-paymaster",
 *   paymasterUserId: "paymaster-user-123",
 *   customConsensus: "approvers.count() >= 2",
 *   executionContractAddress: "0x576A4D741b96996cc93B4919a04c16545734481f",
 *   restrictions: { ... },
 * });
 *
 * await turnkeyClient.apiClient().createPolicy(policy);
 */
export function buildPaymasterExecutionPolicy(config: {
  organizationId: string;
  paymasterUserId: string;
  additionalApprovers?: string[];
  customConsensus?: string;
  executionContractAddress: `0x${string}`;
  restrictions?: {
    allowedEOAs?: `0x${string}`[];
    allowedContracts?: `0x${string}`[];
    maxEthAmount?: bigint;
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

  // Check output contract address using ABI parsing
  // Turnkey parses execute(address _targetEoA, address _to, uint256 ethAmount, bytes _data)
  // and exposes arguments via eth.tx.contract_call_args
  if (
    config.restrictions?.allowedContracts &&
    config.restrictions.allowedContracts.length > 0
  ) {
    const contracts = config.restrictions.allowedContracts
      .map((addr) => {
        const cleanAddr = addr.toLowerCase();
        return `eth.tx.contract_call_args['_to'] == '${cleanAddr}'`;
      })
      .join(" || ");
    conditions.push(`(${contracts})`);
  }

  // Check EOA address using ABI parsing
  if (
    config.restrictions?.allowedEOAs &&
    config.restrictions.allowedEOAs.length > 0
  ) {
    const eoas = config.restrictions.allowedEOAs
      .map((addr) => {
        const cleanAddr = addr.toLowerCase();
        return `eth.tx.contract_call_args['_targetEoA'] == '${cleanAddr}'`;
      })
      .join(" || ");
    conditions.push(`(${eoas})`);
  }

  // Check ETH amount using ABI parsing (direct uint256 comparison)
  if (config.restrictions?.maxEthAmount !== undefined) {
    conditions.push(
      `eth.tx.contract_call_args['ethAmount'] <= ${config.restrictions.maxEthAmount}`,
    );
  }

  if (config.restrictions?.maxGasPrice !== undefined) {
    conditions.push(`eth.tx.gasPrice <= ${config.restrictions.maxGasPrice}`);
  }

  if (config.restrictions?.maxGasLimit !== undefined) {
    conditions.push(`eth.tx.gas <= ${config.restrictions.maxGasLimit}`);
  }

  // Build consensus expression
  let consensus: string;
  if (config.customConsensus) {
    // Use custom consensus if provided
    consensus = config.customConsensus;
  } else if (
    config.additionalApprovers &&
    config.additionalApprovers.length > 0
  ) {
    // Build multi-user AND condition: paymasterUserId AND all additionalApprovers must approve
    const approverConditions = [
      `approvers.any(user, user.id == '${config.paymasterUserId}')`,
      ...config.additionalApprovers.map(
        (id) => `approvers.any(user, user.id == '${id}')`,
      ),
    ];
    consensus = approverConditions.join(" && ");
  } else {
    // Default: only paymasterUserId can approve
    consensus = `approvers.any(user, user.id == '${config.paymasterUserId}')`;
  }

  return {
    organizationId: config.organizationId,
    policyName: config.policyName || "Gas Station Paymaster Execution Policy",
    effect: "EFFECT_ALLOW" as const,
    consensus,
    condition: conditions.join(" && "),
    notes:
      "Restricts which execute() transactions the paymaster can submit on-chain",
  };
}
