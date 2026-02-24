export function parseTokenAmount(amountInput: string, decimals: number): bigint {
  const normalized = amountInput.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Amount must be a positive decimal number.");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const wholePart = BigInt(whole ?? "0") * 10n ** BigInt(decimals);
  const fractionPart = BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
  return wholePart + fractionPart;
}

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
