import {
  AaveV3BaseSepolia,
  MiscBaseSepolia,
} from "@bgd-labs/aave-address-book";
import { turnkeyClient, signWith } from "./util";

/**
 * ABI-based variant of createPolicy.ts.
 *
 * Instead of matching the raw 4-byte function selector via
 * eth.tx.data[0..10], this script uploads each contract's ABI to Turnkey as
 * a smart contract interface and writes the policy against DECODED calls
 * using eth.tx.function_name and eth.tx.contract_call_args. That yields
 * readable, parameter-level rules and lets you cap amounts directly.
 *
 * The upload uses ACTIVITY_TYPE_CREATE_SMART_CONTRACT_INTERFACE via the
 * sdk-server client's createSmartContractInterface method. See:
 * https://docs.turnkey.com/features/policies/smart-contract-interfaces
 *
 * eth.tx.* predicates evaluate against EVERY call in a V2 batch with
 * all-or-nothing semantics: any call outside the allowlist denies the
 * whole batch.
 */

// Minimal ABI fragments covering only the functions the example uses.
// The parameter names here are the keys used to reference decoded arguments
// in policy conditions via eth.tx.contract_call_args['name'].

const FAUCET_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const USDC_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

const POOL_ABI = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "referralCode", type: "uint16" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interestRateMode", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];

// Cap parameter-level rules at 1000 USDC (6 decimals) so amount-based
// conditions on supply and borrow are visibly demonstrated without
// blocking the 90 / 20 amounts the example actually uses.
const AMOUNT_CAP_USDC_6DP = "1000000000"; // 1,000 USDC

async function uploadInterface(params: {
  label: string;
  address: string;
  abi: unknown[];
  notes: string;
}): Promise<string> {
  const client = turnkeyClient();
  const { smartContractInterfaceId } =
    await client.createSmartContractInterface({
      label: params.label,
      notes: params.notes,
      type: "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM",
      smartContractAddress: params.address,
      smartContractInterface: JSON.stringify(params.abi),
    });
  console.log(
    `Uploaded interface: ${params.label} (${params.address}) -> ${smartContractInterfaceId}`,
  );
  return smartContractInterfaceId;
}

async function main() {
  const client = turnkeyClient();
  const userId = process.env.NONROOT_USER_ID!;
  const from = signWith().toLowerCase();

  const usdcAddress = AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING;
  const poolAddress = AaveV3BaseSepolia.POOL;
  const faucetAddress = MiscBaseSepolia.FAUCET;

  // 1. Upload one smart contract interface per contract the example touches.
  const [usdcId, poolId, faucetId] = await Promise.all([
    uploadInterface({
      label: "USDC (Aave Base Sepolia)",
      address: usdcAddress,
      abi: USDC_ABI,
      notes: "ERC20 approve, scoped to Aave batch example.",
    }),
    uploadInterface({
      label: "Aave v3 Pool (Base Sepolia)",
      address: poolAddress,
      abi: POOL_ABI,
      notes: "supply, borrow, repay, withdraw for the Aave batch example.",
    }),
    uploadInterface({
      label: "Aave Faucet (Base Sepolia)",
      address: faucetAddress,
      abi: FAUCET_ABI,
      notes: "mint test USDC for the Aave batch example.",
    }),
  ]);

  // 2. Build the ABI-based policy. Each clause scopes an allowlist of
  //    function names to a specific contract. supply and borrow additionally
  //    cap the amount parameter via eth.tx.contract_call_args['amount'].
  const usdc = `'${usdcAddress.toLowerCase()}'`;
  const pool = `'${poolAddress.toLowerCase()}'`;
  const faucet = `'${faucetAddress.toLowerCase()}'`;

  const clauses = [
    // faucet.mint(...) is the only allowed call to the faucet.
    `(eth.tx.to == ${faucet} && eth.tx.function_name == 'mint')`,
    // USDC.approve(...) is the only allowed call to USDC.
    `(eth.tx.to == ${usdc} && eth.tx.function_name == 'approve')`,
    // Pool.supply amount capped.
    `(eth.tx.to == ${pool} && eth.tx.function_name == 'supply' && eth.tx.contract_call_args['amount'] <= ${AMOUNT_CAP_USDC_6DP})`,
    // Pool.borrow amount capped.
    `(eth.tx.to == ${pool} && eth.tx.function_name == 'borrow' && eth.tx.contract_call_args['amount'] <= ${AMOUNT_CAP_USDC_6DP})`,
    // Pool.repay and Pool.withdraw allowed by name only (max unwinds pass
    // uint256.max as amount, so no cap here).
    `(eth.tx.to == ${pool} && eth.tx.function_name == 'repay')`,
    `(eth.tx.to == ${pool} && eth.tx.function_name == 'withdraw')`,
  ];

  const policyName =
    "Allow non-root user only the example's DeFi batch interactions (ABI)";
  const effect = "EFFECT_ALLOW";
  const consensus = `approvers.any(user, user.id == '${userId}')`;
  const condition = [
    `activity.type == 'ACTIVITY_TYPE_ETH_SEND_TRANSACTION_V2'`,
    `eth.tx.from == '${from}'`,
    `(${clauses.join(" || ")})`,
  ].join(" && ");

  const { policyId } = await client.createPolicy({
    policyName,
    condition,
    consensus,
    effect,
    notes:
      "ABI-decoded per-call enforcement. Every call in the batch must match " +
      "one of the (contract, function_name) pairs, with supply and borrow " +
      "amounts capped at 1,000 USDC.",
  });

  console.log(
    [
      ``,
      `New policy created!`,
      `- Name: ${policyName}`,
      `- Policy ID: ${policyId}`,
      `- Effect: ${effect}`,
      `- Consensus: ${consensus}`,
      `- Condition: ${condition}`,
      ``,
      `Smart contract interfaces:`,
      `- USDC:   ${usdcId}`,
      `- Pool:   ${poolId}`,
      `- Faucet: ${faucetId}`,
      ``,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
