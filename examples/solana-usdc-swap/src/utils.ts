export function solToLamports(solAmount: string): bigint {
  const [whole, fraction = ""] = solAmount.trim().split(".");
  const wholeLamports = BigInt(whole || "0") * 1_000_000_000n;
  const fractionLamports = BigInt((fraction + "0".repeat(9)).slice(0, 9));
  return wholeLamports + fractionLamports;
}

export function lamportsToSol(lamports: bigint | number): string {
  const value = BigInt(lamports);
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, "0");
  return `${whole}.${fraction.slice(0, 4)}`;
}
