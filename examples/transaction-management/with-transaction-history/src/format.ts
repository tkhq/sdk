import type { v1TransactionHistoryTransfer } from "@turnkey/sdk-types";

/** Format atomic units using asset decimals (avoids Number precision loss). */
function formatUnits(value: string, decimals: number): string {
  if (decimals < 0) {
    return value;
  }

  const isNegative = value.startsWith("-");
  const numeric = isNegative ? value.slice(1) : value;
  if (!/^\d+$/.test(numeric)) {
    return value;
  }

  const padded = numeric.padStart(decimals + 1, "0");
  const wholeRaw =
    decimals === 0 ? padded : padded.slice(0, padded.length - decimals);
  const whole = wholeRaw.replace(/^0+(?=\d)/, "");
  const fraction =
    decimals === 0
      ? ""
      : padded.slice(padded.length - decimals).replace(/0+$/, "");

  const sign = isNegative ? "-" : "";
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

/**
 * Prefer API display.crypto when present; otherwise normalize amount with
 * transfer.asset.decimals (already on the transfer — no supported-assets lookup).
 */
export function formatTransfer(transfer: v1TransactionHistoryTransfer): string {
  const symbol = transfer.asset?.symbol ?? "Unknown";
  const amount =
    transfer.display?.crypto ??
    (transfer.asset
      ? formatUnits(transfer.amount, transfer.asset.decimals)
      : transfer.amount);

  return `${transfer.direction} ${amount} ${symbol}`;
}
