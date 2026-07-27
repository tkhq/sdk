const USDC_DECIMALS = 6;

export function parseUsdcAmount(value: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Invalid AMOUNT_USDC "${value}". Use a positive decimal with at most 6 decimal places.`,
    );
  }

  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(USDC_DECIMALS, "0");
  const amount =
    BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(fraction || "0");

  if (amount <= 0n) {
    throw new Error("AMOUNT_USDC must be greater than zero.");
  }

  return amount;
}

export function formatUsdcAmount(raw: bigint): string {
  const divisor = 10n ** BigInt(USDC_DECIMALS);
  const whole = raw / divisor;
  const fraction = (raw % divisor)
    .toString()
    .padStart(USDC_DECIMALS, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function lamportsToSol(lamports: number | bigint): string {
  const raw = BigInt(lamports);
  const divisor = 1_000_000_000n;
  const whole = raw / divisor;
  const fraction = (raw % divisor)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
