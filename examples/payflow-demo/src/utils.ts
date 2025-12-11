import { ethers } from "ethers";

// USDC token addresses for different networks
export const USDC_TOKEN_ADDRESSES: Record<string, string> = {
  sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  goerli: "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
  mainnet: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
};

// ERC-20 ABI for USDC transfers
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint amount)",
];

// USDC has 6 decimals
export const USDC_DECIMALS = 6;

// Convert atomic amounts to readable amounts
export function toReadableAmount(
  rawAmount: number | string | bigint,
  decimals: number = USDC_DECIMALS,
): string {
  return ethers.formatUnits(rawAmount.toString(), decimals);
}

// Convert readable amounts to atomic amounts
export function fromReadableAmount(
  amount: number | string,
  decimals: number = USDC_DECIMALS,
): bigint {
  return ethers.parseUnits(amount.toString(), decimals);
}

// Helper to refine non-null values
export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string,
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }
  return input;
}

// Format address for display
export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

