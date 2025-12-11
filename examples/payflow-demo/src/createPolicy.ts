import { getTurnkeyClientForSubOrg } from "./provider";
import { refineNonNull } from "./utils";

/**
 * Creates a policy in a merchant's sub-organization that enforces strict USDC transfer restrictions.
 * 
 * This policy enforces TWO critical restrictions:
 * 1. ONLY USDC transfers: Only allows transactions to the USDC token contract
 * 2. ONLY to treasury: Only allows transfers to the treasury wallet address (enforced via calldata parsing)
 * 
 * The threshold check (minimum amount) is enforced at the application level in sweepUSDC.ts
 * and reads from SWEEP_THRESHOLD_USDC environment variable.
 * 
 * ERC-20 transfer function: transfer(address to, uint256 amount)
 * Function selector: 0xa9059cbb
 * Calldata structure: [selector(4 bytes)][to(32 bytes)][amount(32 bytes)]
 * 
 * @param subOrganizationId - The sub-organization ID where the policy should be created (merchant's sub-org)
 * @param policyName - Human-readable name for the policy
 * @param treasuryAddress - The treasury wallet address (only destination allowed)
 * @param usdcTokenAddress - The USDC token contract address
 * @param sweepThresholdUSDC - Minimum USDC amount required (default: 0.03, configurable via SWEEP_THRESHOLD_USDC env var)
 *                              Note: This is enforced at application level, not policy level
 */
export async function createUSDCOnlyPolicy(
  subOrganizationId: string,
  policyName: string,
  treasuryAddress: string,
  usdcTokenAddress: string,
  sweepThresholdUSDC: number = 0.03,
): Promise<string> {
  // Create client for the sub-organization - policies must be created in the sub-org to apply to its wallets
  const turnkeyClient = getTurnkeyClientForSubOrg(subOrganizationId);

  // ERC-20 transfer function selector: transfer(address,uint256) = 0xa9059cbb
  // Calldata structure: 0xa9059cbb (4 bytes) + to address (32 bytes) + amount (32 bytes)
  // Turnkey's eth.tx.data includes the 0x prefix, so positions start at index 2
  // Selector: [2..10], to address: [10..74], amount: [74..138]
  
  // Prepare treasury address for calldata comparison (remove 0x, pad to 64 hex chars)
  const treasuryAddressPadded = treasuryAddress.toLowerCase().slice(2).padStart(64, '0');
  
  // Build policy condition - only two restrictions:
  // 1. Transaction must be to USDC contract
  // 2. Transfer destination must be treasury address (enforced via calldata parsing)
  // Note: The threshold check is enforced at the application level in sweepUSDC.ts
  const condition = [
    `eth.tx.to == '${usdcTokenAddress.toLowerCase()}'`, // Must be to USDC contract
    `eth.tx.data[2..10] == 'a9059cbb'`, // ERC-20 transfer function selector
    `eth.tx.data[10..74] == '${treasuryAddressPadded}'`, // Treasury address (padded to 32 bytes in calldata)
  ].join(" && ");
  
  // Consensus: Requires any approver (simplified for demo)
  // In production, you'd specify specific user IDs or more complex rules
  // See: https://docs.turnkey.com/concepts/policies/examples/access-control
  const consensus = "approvers.count() >= 1";

  const { policyId } = await turnkeyClient.apiClient().createPolicy({
    organizationId: subOrganizationId, // Explicitly set to ensure policy is created in sub-org
    policyName,
    condition,
    consensus,
    effect: "EFFECT_ALLOW",
    notes: `USDC-only policy for merchant sub-org: Only allows USDC transfers to treasury wallet ${treasuryAddress}. Threshold (${sweepThresholdUSDC} USDC) enforced at application level.`,
  });

  return refineNonNull(policyId, "Failed to create USDC-only policy");
}

