// Shared by the browser, the API routes and the scripts. No secrets here.
import { isAddress, zeroAddress, type Address } from "viem";

export const BASE_SEPOLIA_CAIP2 = "eip155:84532" as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

// Policy conditions compare strings exactly, so every address in this example
// is kept in lowercase hex. This is Circle's USDC on Base Sepolia.
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

// keccak256("transfer(address,uint256)")[0..4]
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

export type DestinationCheck =
  | { ok: true; address: Address }
  | { ok: false; error: string };

// The user types the destination, and the policy allows any call to it, so
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

const POLICY_NAME_PREFIX = "Deposit sweep to ";

// The single policy that turns the API key user into a delegated sweeper. The
// user approves it from their own session, for a destination they chose. It
// allows exactly two shapes of Ethereum transaction:
//   1. anything sent to the destination (native ETH sends)
//   2. a USDC `transfer` whose recipient argument is the destination
// Everything else, including raw payload signing, has no matching ALLOW and is
// denied by the policy engine.
//
// Calldata layout: "0x" (2 chars) + selector (8) + recipient padded to 32 bytes
// (64), so the 20-byte recipient is characters 34..74.
export function buildSweepPolicy(
  delegatedUserId: string,
  destination: Address,
) {
  const to = destination.toLowerCase();
  const recipientWord = to.slice(2);

  return {
    policyName: `${POLICY_NAME_PREFIX}${to}`,
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${delegatedUserId}')`,
    condition:
      `eth.tx.to == '${to}' || ` +
      `(eth.tx.to == '${USDC_ADDRESS}' && ` +
      `eth.tx.data[0..10] == '${ERC20_TRANSFER_SELECTOR}' && ` +
      `eth.tx.data[34..74] == '${recipientWord}')`,
    notes:
      "Lets the platform's delegated key sweep ETH and USDC on Base Sepolia to the destination the user chose, and nothing else.",
  };
}

// Finds the sweep policies in a sub-org and the destination each one names.
// The sub-org is the source of truth for the destination: the name only says
// where to look, and a policy counts only if rebuilding it gives the same
// condition and consensus.
export function findSweepPolicies<
  P extends { policyName: string; condition: string; consensus: string },
>(policies: P[], delegatedUserId: string) {
  return policies.flatMap((policy) => {
    if (!policy.policyName.startsWith(POLICY_NAME_PREFIX)) return [];
    const destination = parseAddress(
      policy.policyName.slice(POLICY_NAME_PREFIX.length),
    );
    if (!destination) return [];
    const expected = buildSweepPolicy(delegatedUserId, destination);
    return policy.condition === expected.condition &&
      policy.consensus === expected.consensus
      ? [{ policy, destination }]
      : [];
  });
}
