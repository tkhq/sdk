import { ethers } from "ethers";

/**
 * Convert a raw bigint token balance into a human-readable decimal string.
 *
 * @param raw - the token balance as a bigint or numeric string
 * @param decimals - the token's decimal precision (6, 18, etc.)
 * @param precision - how many digits to show after the decimal (default = 4)
 */
export function toReadableAmount(
  raw: string | bigint,
  decimals: number,
  precision = 4,
): string {
  const amount = typeof raw === "bigint" ? raw : BigInt(raw);
  const formatted = ethers.formatUnits(amount, decimals);
  const [int, frac = ""] = formatted.split(".");

  return frac.length > precision
    ? `${int}.${frac.slice(0, precision)}`
    : `${int}.${frac.padEnd(precision, "0")}`;
}

/**
 * Convenience enum for provider selection.
 */
export enum Environment {
  GOERLI = "goerli",
  MAINNET = "homestead",
}
