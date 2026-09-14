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
 * Ceiling for sessions issued with either profile, in seconds. A login may
 * ask for less, never more. Fifteen minutes keeps the cap visible in the demo.
 */
export const PROFILE_EXPIRATION_SECONDS = "900";

/**
 * Two session profiles, one action each. Same language as policy conditions.
 *
 * - `activity.kind` is version-agnostic, so a profile keeps working if
 *   ETH_SEND_TRANSACTION gets a V3. Profiles are immutable, which makes that
 *   matter.
 * - Each scope pins a contract AND a decoded function name; the approve scope
 *   also pins the spender argument. `function_name` and `contract_call_args`
 *   are only populated when this sub-organization has a smart contract
 *   interface for `eth.tx.to`; without one they are empty and the scope is
 *   false.
 * - Why two profiles rather than one with `||`: the policy engine evaluates
 *   every clause on every request (it does not short circuit; see the
 *   Appendix of the policy language docs), so a clause that reads an
 *   argument the call does not have, `contract_call_args['spender']` on a
 *   `deposit`, cannot be evaluated. One policy or profile per action is the
 *   standard pattern for exactly this reason: every clause is then evaluable
 *   on the one call its session sends. The client holds a session per
 *   profile and composes them.
 */

/** approve-only: `USDC.approve(spender)` where spender is MiniBank. */
export function buildApproveOnlyScope(
  usdc: `0x${string}` = USDC_ADDRESS,
  minibank: `0x${string}` = MINIBANK_ADDRESS,
): string {
  const u = usdc.toLowerCase();
  const m = minibank.toLowerCase();
  return `activity.kind == 'ETH_SEND_TRANSACTION' && eth.tx.to == '${u}' && eth.tx.function_name == 'approve' && eth.tx.contract_call_args['spender'] == '${m}'`;
}

/** deposit-only: `MiniBank.deposit(amount)`, any amount. */
export function buildDepositOnlyScope(
  minibank: `0x${string}` = MINIBANK_ADDRESS,
): string {
  const m = minibank.toLowerCase();
  return `activity.kind == 'ETH_SEND_TRANSACTION' && eth.tx.to == '${m}' && eth.tx.function_name == 'deposit'`;
}

export const SCOPE_VARIANTS = {
  "approve-only": {
    name: "approve-only",
    build: buildApproveOnlyScope,
    notes:
      "with-scoped-deposit-session example: USDC.approve with MiniBank as " +
      "spender, nothing else.",
  },
  "deposit-only": {
    name: "deposit-only",
    build: buildDepositOnlyScope,
    notes:
      "with-scoped-deposit-session example: MiniBank.deposit, nothing else. " +
      "Withdrawals need a passkey stamp.",
  },
} as const;
export type ScopeVariant = keyof typeof SCOPE_VARIANTS;

/** Env var that carries each variant's session profile id. */
export const PROFILE_ENV: Record<ScopeVariant, string> = {
  "approve-only": "NEXT_PUBLIC_SESSION_PROFILE_ID_APPROVE_ONLY",
  "deposit-only": "NEXT_PUBLIC_SESSION_PROFILE_ID_DEPOSIT_ONLY",
};

/**
 * Profile ids by variant. Next.js inlines `process.env.NEXT_PUBLIC_*` only
 * when the name is written out literally, hence no loop over PROFILE_ENV.
 * A variant with no id is simply not offered by the app.
 */
export const PROFILE_IDS: Record<ScopeVariant, string | undefined> = {
  "approve-only": process.env.NEXT_PUBLIC_SESSION_PROFILE_ID_APPROVE_ONLY,
  "deposit-only": process.env.NEXT_PUBLIC_SESSION_PROFILE_ID_DEPOSIT_ONLY,
};

export const CONFIGURED_VARIANTS = (
  Object.keys(SCOPE_VARIANTS) as ScopeVariant[]
).filter((v) => !!PROFILE_IDS[v]);

/** Which variant a session profile id belongs to, if any. */
export function variantForProfileId(id: string | undefined) {
  if (!id) return undefined;
  return CONFIGURED_VARIANTS.find((v) => PROFILE_IDS[v] === id);
}

/** Which known scope a JWT's scope claim matches, if any. */
export function identifyScope(scope: string): ScopeVariant | undefined {
  const n = normalizeScope(scope);
  return (Object.keys(SCOPE_VARIANTS) as ScopeVariant[]).find(
    (k) => normalizeScope(SCOPE_VARIANTS[k].build()) === n,
  );
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
