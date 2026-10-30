// Shared by the browser, the API routes and the scripts. No secrets here.
import { isAddress, type Address } from "viem";

export const BASE_SEPOLIA_CAIP2 = "eip155:84532" as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

// Policy conditions compare strings exactly, so every address in this example
// is kept in lowercase hex. This is Circle's USDC on Base Sepolia.
export const USDC_ADDRESS: Address =
  "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
export const USDC_DECIMALS = 6;

// keccak256("transfer(address,uint256)")[0..4]
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

export type SweepAsset = "ETH" | "USDC";

export function parseAddress(value: string | undefined): Address | null {
  const lower = value?.trim().toLowerCase() ?? "";
  return isAddress(lower) ? lower : null;
}

// The single policy that turns the API key user into a delegated sweeper.
// It allows exactly two shapes of Ethereum transaction:
//   1. anything sent to the treasury (native ETH sends)
//   2. a USDC `transfer` whose recipient argument is the treasury
// Everything else, including raw payload signing, has no matching ALLOW and is
// denied by the policy engine.
//
// The USDC branch checks raw calldata instead of `eth.tx.contract_call_args`,
// because the named-argument form only works after the USDC ABI is uploaded
// as a smart contract interface in every user's sub-organization. Calldata
// layout: "0x" (2 chars) + selector (8) + recipient padded to 32 bytes (64),
// so the 20-byte recipient is characters 34..74.
export function buildSweepPolicy(delegatedUserId: string, treasury: Address) {
  const to = treasury.toLowerCase();
  const recipientWord = to.slice(2);

  return {
    policyName: `Deposit sweep to ${to}`,
    effect: "EFFECT_ALLOW" as const,
    consensus: `approvers.any(user, user.id == '${delegatedUserId}')`,
    condition:
      `eth.tx.to == '${to}' || ` +
      `(eth.tx.to == '${USDC_ADDRESS}' && ` +
      `eth.tx.data[0..10] == '${ERC20_TRANSFER_SELECTOR}' && ` +
      `eth.tx.data[34..74] == '${recipientWord}')`,
    notes:
      "Lets the platform's delegated key sweep ETH and USDC on Base Sepolia to the treasury, and nothing else.",
  };
}
