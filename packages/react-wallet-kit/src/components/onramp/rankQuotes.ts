import type { v1FiatOnRampAmount, v1FiatOnRampQuote } from "@turnkey/core";

export type QuoteRankLabel = "Lowest fees" | "Highest crypto yield";

export function rankQuotes(quotes: v1FiatOnRampQuote[]): {
  quote: v1FiatOnRampQuote;
  labels: QuoteRankLabel[];
}[] {
  const lowestFees = quotes.reduce<v1FiatOnRampQuote | undefined>(
    (best, quote) =>
      !best || compareAmounts(quote.totalFee, best.totalFee) < 0 ? quote : best,
    undefined,
  );
  const highestYield = quotes.reduce<v1FiatOnRampQuote | undefined>(
    (best, quote) =>
      !best || compareAmounts(quote.cryptoAmount, best.cryptoAmount) > 0
        ? quote
        : best,
    undefined,
  );
  if (!lowestFees) return [];

  const rest = quotes
    .filter((quote) => quote.quoteId !== lowestFees.quoteId)
    .sort((a, b) => compareAmounts(a.totalFee, b.totalFee));

  return [lowestFees, ...rest].map((quote) => ({
    quote,
    labels: [
      ...(quote.quoteId === lowestFees.quoteId
        ? (["Lowest fees"] as const)
        : []),
      ...(quote.quoteId === highestYield?.quoteId
        ? (["Highest crypto yield"] as const)
        : []),
    ],
  }));
}

function compareAmounts(a: v1FiatOnRampAmount, b: v1FiatOnRampAmount): number {
  const scale = Math.max(a.decimals, b.decimals);
  const left = scaleAmount(a, scale);
  const right = scaleAmount(b, scale);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function scaleAmount(amount: v1FiatOnRampAmount, decimals: number): bigint {
  let value: bigint;
  try {
    value = BigInt(amount.amount);
  } catch {
    return 0n;
  }

  const delta = decimals - amount.decimals;
  if (delta === 0) return value;
  if (delta > 0) return value * 10n ** BigInt(delta);
  return value / 10n ** BigInt(-delta);
}
