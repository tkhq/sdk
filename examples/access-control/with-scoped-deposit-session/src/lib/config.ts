/**
 * Shared constants for the setup script and the browser app: chain, contract
 * addresses, the ABI fragments Turnkey needs to decode calls, and the session
 * profile scope.
 *
 * Everything the policy engine compares addresses against is lowercased.
 * `eth.tx.to` is normalised to lowercase by the engine, and the example keeps
 * every literal in the same form so a reader never has to wonder which case
 * a clause expects.
 */

export const CAIP2_BASE_SEPOLIA = "eip155:84532" as const;
export const BASESCAN = "https://sepolia.basescan.org";

/** Circle USDC on Base Sepolia. Faucet: https://faucet.circle.com */
export const USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
).toLowerCase() as `0x${string}`;
export const USDC_DECIMALS = 6;

/**
 * MiniBank on Base Sepolia, deployed once for this example. Source and
 * verification on Basescan. Override with NEXT_PUBLIC_MINIBANK_ADDRESS to
 * point at your own instance.
 */
export const MINIBANK_ADDRESS = (
  process.env.NEXT_PUBLIC_MINIBANK_ADDRESS ??
  "0xcAdD4bb1Cfcd76C25f3702AD698679CbD934d12E"
).toLowerCase() as `0x${string}`;

/**
 * The ERC-20 surface the example touches. `approve` is what the scope allows;
 * `transfer` is uploaded too so the denial slice can show a call that Turnkey
 * decodes correctly and still rejects, as opposed to calldata it cannot
 * decode at all. `balanceOf` is for reads.
 */
export const ERC20_ABI = [
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
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/** MiniBank's full ABI. Two writes, two reads, two events, three errors. */
export const MINIBANK_ABI = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [{ name: "token_", type: "address" }],
  },
  {
    type: "function",
    name: "TOKEN",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "Deposited",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdrawn",
    anonymous: false,
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  { type: "error", name: "ZeroAmount", inputs: [] },
  {
    type: "error",
    name: "InsufficientBalance",
    inputs: [
      { name: "requested", type: "uint256" },
      { name: "available", type: "uint256" },
    ],
  },
  { type: "error", name: "TransferFailed", inputs: [] },
] as const;

/** Name of the session profile. Also becomes `session_type` in the JWT. */
export const DEPOSIT_PROFILE_NAME = "minibank-deposit-only";

/**
 * Ceiling for sessions issued with the profile, in seconds. A login may ask
 * for less, never more. Fifteen minutes keeps the cap visible in the demo.
 */
export const DEPOSIT_PROFILE_EXPIRATION_SECONDS = "900";

/**
 * The scope. Same language as policy conditions.
 *
 * - `activity.kind` is version-agnostic, so the profile keeps working if
 *   ETH_SEND_TRANSACTION gets a V3. Profiles are immutable, which makes that
 *   matter.
 * - Each clause pins a contract AND a decoded function name, and the approve
 *   clause pins the spender argument. `function_name` and
 *   `contract_call_args` are only populated when a smart contract interface
 *   for `eth.tx.to` has been uploaded; without one they are empty and every
 *   clause is false.
 * - Batches are all-or-nothing: every call in an ETH_SEND_TRANSACTION must
 *   satisfy the scope or the whole activity is denied.
 */
export function buildDepositScope(
  usdc: `0x${string}` = USDC_ADDRESS,
  minibank: `0x${string}` = MINIBANK_ADDRESS,
): string {
  const u = usdc.toLowerCase();
  const m = minibank.toLowerCase();
  const approveForMinibank = `(eth.tx.to == '${u}' && eth.tx.function_name == 'approve' && eth.tx.contract_call_args['spender'] == '${m}')`;
  const deposit = `(eth.tx.to == '${m}' && eth.tx.function_name == 'deposit')`;
  return `activity.kind == 'ETH_SEND_TRANSACTION' && (${approveForMinibank} || ${deposit})`;
}

/** Collapse whitespace so two renderings of the same scope compare equal. */
export function normalizeScope(scope: string): string {
  return scope.replace(/\s+/g, " ").trim();
}

/** Multi-line rendering of a scope for logs and UI. */
export function formatScope(scope: string): string {
  return normalizeScope(scope)
    .replace(" && (", " && (\n  ")
    .replace(" || ", "\n  ||\n  ")
    .replace(/\)$/, "\n)");
}
