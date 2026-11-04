// Shared by the browser, the API routes and the scripts. No secrets here.
import { getAddress, isAddress, zeroAddress, type Address } from "viem";

export const BASE_SEPOLIA_CAIP2 = "eip155:84532" as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

// Policy conditions compare strings exactly, so addresses in this example are
// kept in lowercase hex unless noted. This is Circle's USDC on Base Sepolia.
export const USDC_ADDRESS: Address =
  "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
export const USDC_DECIMALS = 6;

export type SweepAsset = "ETH" | "USDC";

export function parseAddress(value: string | undefined): Address | null {
  const lower = value?.trim().toLowerCase() ?? "";
  return isAddress(lower) ? lower : null;
}

// Classifies a CAIP-19 asset id on Base Sepolia. Tokens are matched by
// contract address, never by symbol, so a look-alike "USDC" is ignored.
export function sweepAssetOf(caip19: string): SweepAsset | null {
  const id = caip19.toLowerCase();
  if (!id.startsWith(`${BASE_SEPOLIA_CAIP2}/`)) return null;
  if (id === `${BASE_SEPOLIA_CAIP2}/erc20:${USDC_ADDRESS}`) return "USDC";
  if (id === `${BASE_SEPOLIA_CAIP2}/slip44:60`) return "ETH";
  return null;
}

// Uploaded into each sub-organization when the user enables the address. The
// policy engine decodes USDC calls with this ABI, which is what fills in
// `eth.tx.function_name` and `eth.tx.contract_call_args`. A parent-org upload
// does not count: only the sub-org sending the transaction is consulted.
//
// Only `transfer` is uploaded, because that is all the USDC policy reads. Turnkey
// rejects viem's full `erc20Abi` as invalid.
const USDC_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

export const USDC_INTERFACE = {
  label: "USDC (Base Sepolia)",
  notes: "ERC-20 transfer, so the USDC policy can read the recipient.",
  type: "SMART_CONTRACT_INTERFACE_TYPE_ETHEREUM" as const,
  smartContractAddress: USDC_ADDRESS,
  smartContractInterface: JSON.stringify(USDC_TRANSFER_ABI),
};

// The name `USDC_TRANSFER_ABI` gives the first argument of `transfer`. The
// uploaded ABI decides this key, not the deployed contract.
const TRANSFER_RECIPIENT_ARG = "recipient";

export type DestinationCheck =
  | { ok: true; address: Address }
  | { ok: false; error: string };

// The user types the destination, and the ETH policy allows any call to it, so
// some addresses must never be accepted. Naming the USDC contract would let
// the key make any USDC call, including `approve` or `transfer` to anyone.
// Naming the deposit address would sweep every deposit back into itself.
export function parseDestination(
  value: string | undefined,
  depositAddress: Address,
): DestinationCheck {
  const address = parseAddress(value);
  if (!address) return { ok: false, error: "Enter a valid 0x address." };
  if (address === zeroAddress) {
    return { ok: false, error: "The destination cannot be the zero address." };
  }
  if (address === USDC_ADDRESS) {
    return {
      ok: false,
      error: "The destination cannot be the USDC contract.",
    };
  }
  if (address === depositAddress) {
    return {
      ok: false,
      error: "The destination cannot be the deposit address itself.",
    };
  }
  return { ok: true, address };
}

const ETH_POLICY_PREFIX = "Deposit sweep ETH to ";
const USDC_POLICY_PREFIX = "Deposit sweep USDC to ";

// The two policies that turn the API key user into a delegated sweeper. The
// user approves them from their own session, for a destination they chose:
//   1. ETH: anything sent to the destination
//   2. USDC: a `transfer` whose decoded recipient argument is the destination
// Everything else, including raw payload signing, has no matching ALLOW and is
// denied by the policy engine.
//
// They must be separate. The engine does not short-circuit a condition, so one
// that joined these with `||` would read `eth.tx.function_name` on a plain ETH
// send, where no call is decoded, and fail for both kinds of send.
//
// `eth.tx.to` is compared in lowercase, and a decoded address argument in its
// checksummed spelling.
export function buildSweepPolicies(
  delegatedUserId: string,
  destination: Address,
) {
  const to = destination.toLowerCase();
  const recipient = `eth.tx.contract_call_args['${TRANSFER_RECIPIENT_ARG}']`;
  const consensus = `approvers.any(user, user.id == '${delegatedUserId}')`;

  return [
    {
      policyName: `${ETH_POLICY_PREFIX}${to}`,
      effect: "EFFECT_ALLOW" as const,
      consensus,
      condition: `eth.tx.to == '${to}'`,
      notes:
        "Lets the platform's delegated key sweep ETH on Base Sepolia to the destination the user chose, and nowhere else.",
    },
    {
      policyName: `${USDC_POLICY_PREFIX}${to}`,
      effect: "EFFECT_ALLOW" as const,
      consensus,
      condition:
        `eth.tx.to == '${USDC_ADDRESS}' && ` +
        `eth.tx.function_name == 'transfer' && ` +
        `${recipient} == '${getAddress(to)}'`,
      notes:
        "Lets the platform's delegated key sweep USDC on Base Sepolia to the destination the user chose, and nowhere else.",
    },
  ];
}

// Finds the destinations a sub-org's policies sweep to. The sub-org is the
// source of truth: the name only says where to look, and a destination counts
// only if both of its policies are there with the condition and consensus that
// rebuilding them gives.
export function findSweepDestinations<
  P extends { policyName: string; condition: string; consensus: string },
>(policies: P[], delegatedUserId: string): Address[] {
  const named = new Set(
    policies.flatMap((policy) => {
      const prefix = [ETH_POLICY_PREFIX, USDC_POLICY_PREFIX].find((p) =>
        policy.policyName.startsWith(p),
      );
      if (!prefix) return [];
      const destination = parseAddress(policy.policyName.slice(prefix.length));
      return destination ? [destination] : [];
    }),
  );
  return [...named].filter((destination) =>
    buildSweepPolicies(delegatedUserId, destination).every((expected) =>
      policies.some(
        (policy) =>
          policy.policyName === expected.policyName &&
          policy.condition === expected.condition &&
          policy.consensus === expected.consensus,
      ),
    ),
  );
}
