/**
 * Shared constants for the setup script and the browser app: chain, contract
 * addresses, the ABI fragments the app uses to encode calls and read balances,
 * and the session profile scope.
 *
 * Everything the policy engine compares addresses against is lowercased.
 * `eth.tx.to` is normalised to lowercase by the engine, and the example keeps
 * every literal in the same form so a reader never has to wonder which case
 * a clause expects.
 */
import { toFunctionSelector } from "viem";

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
 * `transfer` is here so the denial slice can send a well-formed call to the
 * right contract with the wrong selector. `balanceOf` and `allowance` are for
 * reads. Nothing here is uploaded to Turnkey: the scope matches on raw
 * calldata, so no smart contract interface is needed.
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
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
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

/**
 * Ceiling for sessions issued with the profile, in seconds. A login may ask
 * for less, never more. Fifteen minutes keeps the cap visible in the demo.
 */
export const PROFILE_EXPIRATION_SECONDS = "900";

/**
 * Four-byte function selectors, derived from the ABIs above so they cannot
 * drift from the calldata the app encodes. `eth.tx.data[0..10]` is the "0x"
 * plus the first eight hex characters of the calldata, which is exactly this.
 */
const abiFn = (abi: readonly { type: string; name?: string }[], name: string) =>
  abi.find((f) => f.type === "function" && f.name === name) as Parameters<
    typeof toFunctionSelector
  >[0];
export const SELECTORS = {
  /** approve(address,uint256) = 0x095ea7b3 */
  approve: toFunctionSelector(abiFn(ERC20_ABI, "approve")),
  /** transfer(address,uint256) = 0xa9059cbb */
  transfer: toFunctionSelector(abiFn(ERC20_ABI, "transfer")),
  /** deposit(uint256) = 0xb6b55f25 */
  deposit: toFunctionSelector(abiFn(MINIBANK_ABI, "deposit")),
  /** withdraw(uint256) = 0x2e1a7d4d */
  withdraw: toFunctionSelector(abiFn(MINIBANK_ABI, "withdraw")),
} as const;

/**
 * The session profile. One scope, two allowed calls, same language as
 * policy conditions.
 *
 * - `activity.kind` is version-agnostic, so the profile keeps working if
 *   ETH_SEND_TRANSACTION gets a V3. Profiles are immutable, which makes that
 *   matter.
 * - Every call must carry no native value and go to one of two contracts
 *   with one specific selector. The approve branch also pins the spender by
 *   reading it straight out of the calldata: `approve(address,uint256)` is
 *   `0x` + 8 selector chars + 24 chars of padding + 40 address chars, so the
 *   address sits at `[34..74]`.
 * - Raw calldata instead of `function_name` / `contract_call_args`: those
 *   fields are only populated when the sub-organization sending the
 *   transaction holds a smart contract interface for `eth.tx.to`, and the
 *   parent's interfaces do not count. Uploading interfaces into every new
 *   sub-organization needs a credential that may do so, which is exactly the
 *   unscoped session this example refuses to hold. Raw calldata needs nothing
 *   uploaded, so the very first session a user gets is already scoped.
 * - Both branches in one scope: the engine evaluates every clause on every
 *   call (no short circuit). That works here because nothing in either
 *   branch can be missing on the other branch's call: `deposit(uint256)`
 *   calldata is exactly 74 characters, so the approve branch's `[34..74]`
 *   is in range on a deposit. With `contract_call_args['spender']` it was
 *   not, and the scope had to be split into one profile per action.
 */
export const PROFILE_NAME = "approve-and-deposit";

export function buildScope(
  usdc: `0x${string}` = USDC_ADDRESS,
  minibank: `0x${string}` = MINIBANK_ADDRESS,
): string {
  const u = usdc.toLowerCase();
  const m = minibank.toLowerCase();
  const spender = m.slice(2);
  const approve = `eth.tx.to == '${u}' && eth.tx.data[0..10] == '${SELECTORS.approve}' && eth.tx.data[34..74] == '${spender}'`;
  const deposit = `eth.tx.to == '${m}' && eth.tx.data[0..10] == '${SELECTORS.deposit}'`;
  return `activity.kind == 'ETH_SEND_TRANSACTION' && eth.tx.value == 0 && ((${approve}) || (${deposit}))`;
}

export const PROFILE_NOTES =
  "with-scoped-deposit-session example: USDC.approve with MiniBank as " +
  "spender, or MiniBank.deposit, matched on raw calldata. Withdrawals need " +
  "a passkey stamp.";

/** Env var that carries the session profile id. */
export const PROFILE_ENV = "NEXT_PUBLIC_SESSION_PROFILE_ID";

/**
 * The profile id, inlined by Next.js at build time. Written out literally
 * because `process.env[name]` is not inlined.
 */
export const PROFILE_ID: string | undefined =
  process.env.NEXT_PUBLIC_SESSION_PROFILE_ID;

/** Whether a JWT's scope claim is the scope this app expects. */
export function isExpectedScope(scope: string): boolean {
  return normalizeScope(scope) === normalizeScope(buildScope());
}

/** Collapse whitespace so two renderings of the same scope compare equal. */
export function normalizeScope(scope: string): string {
  return scope.replace(/\s+/g, " ").trim();
}

/**
 * Multi-line rendering of a scope for logs and UI. Top-level `&&` clauses
 * go one per line; the parenthesised `||` group gets its branches on their
 * own lines. Address literals contain no parentheses, so depth is tracked
 * by counting them.
 */
export function formatScope(scope: string): string {
  const s = normalizeScope(scope);
  let out = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (depth === 0 && s.startsWith(" && ((", i)) {
      out += "\n  && (\n    (";
      depth += 2;
      i += 5;
    } else if (depth === 0 && s.startsWith(" && ", i)) {
      out += "\n  && ";
      i += 3;
    } else if (depth === 1 && s.startsWith(" || ", i)) {
      out += "\n    ||\n    ";
      i += 3;
    } else if (s[i] === "(") {
      depth++;
      out += "(";
    } else if (s[i] === ")") {
      depth--;
      out += depth === 0 ? "\n  )" : ")";
    } else {
      out += s[i];
    }
  }
  return out;
}
