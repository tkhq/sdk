export type SplToken = {
  mint: string;
  decimals: number;
  symbol: string;
  name: string;
};

export const USDC_DEVNET: SplToken = {
  mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  decimals: 6,
  symbol: "USDC",
  name: "USD Coin",
};

export const USDC_MAINNET: SplToken = {
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  decimals: 6,
  symbol: "USDC",
  name: "USD Coin",
};
