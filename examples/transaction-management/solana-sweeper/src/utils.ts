/**
 * Convert a raw bigint token balance into a human-readable decimal string.
 *
 * Works for both SPL tokens (arbitrary decimals) and native SOL (9 decimals).
 */
export function toReadableAmount(
  raw: bigint,
  decimals: number,
  precision = 4,
): string {
  const divisor = 10n ** BigInt(decimals);
  const intPart = raw / divisor;
  const fracPart = raw % divisor;

  const fracStr = fracPart.toString().padStart(decimals, "0");

  return precision > 0
    ? `${intPart}.${fracStr.slice(0, precision)}`
    : intPart.toString();
}

/** Format lamports as a human-readable SOL string. */
export function lamportsToSol(lamports: number | bigint): string {
  return toReadableAmount(BigInt(lamports), 9);
}
