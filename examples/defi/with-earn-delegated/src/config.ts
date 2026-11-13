import type { v1ListSupportedAssetsRequest } from "@turnkey/sdk-server";

// The SDK's own chain list, so a typo here fails `pnpm typecheck`.
export type Caip2 = v1ListSupportedAssetsRequest["caip2"];

// Every mainnet chain that Turnkey Swap and the Balances API both support, with
// a display name and (where there's a standard one) a block explorer.
export const CHAINS: { caip2: Caip2; name: string; explorer?: string }[] = [
  { caip2: "eip155:1", name: "Ethereum", explorer: "https://etherscan.io/tx/" },
  { caip2: "eip155:8453", name: "Base", explorer: "https://basescan.org/tx/" },
  {
    caip2: "eip155:42161",
    name: "Arbitrum",
    explorer: "https://arbiscan.io/tx/",
  },
  {
    caip2: "eip155:10",
    name: "Optimism",
    explorer: "https://optimistic.etherscan.io/tx/",
  },
  {
    caip2: "eip155:137",
    name: "Polygon",
    explorer: "https://polygonscan.com/tx/",
  },
  {
    caip2: "eip155:56",
    name: "BNB Chain",
    explorer: "https://bscscan.com/tx/",
  },
  { caip2: "eip155:143", name: "Monad" },
  { caip2: "eip155:4217", name: "Tempo" },
  { caip2: "eip155:4663", name: "Robinhood Chain" },
  { caip2: "eip155:5042", name: "Arc" },
  {
    caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    name: "Solana",
    explorer: "https://solscan.io/tx/",
  },
];

// Chains the watcher ignores. Ethereum mainnet by default: sponsored gas there
// costs dollars per transaction.
export const EXCLUDED_CHAINS: Caip2[] = ["eip155:1"];

// Taken out of Turnkey's stablecoin list: non-dollar stablecoins, and anything
// else you don't want the demo to accept or invest in.
export const EXCLUDED_SYMBOLS = ["EURC"];

// Balances below this are ignored, so dust and rounding leftovers don't
// trigger sponsored swaps that cost more than they earn.
export const MIN_INVEST_USD = 1;

// `redeem` always returns this asset to the deposit wallet. It must be an EVM
// asset: the return transfer and its policy are EVM only.
export const RETURN_ASSET = { symbol: "USDC", caip2: "eip155:8453" as Caip2 };

// Watcher and swap tuning.
export const POLL_SECONDS = 20;
export const SLIPPAGE_BPS = "50"; // requested on each quote
export const MAX_SLIPPAGE_BPS = 100; // policy cap; must be >= SLIPPAGE_BPS
export const SWAP_WAIT_MINUTES = 10; // cross-chain swaps can take minutes to settle

// Enterprise swap features, billed to the parent org within its spend limits.
// Turn them on for the parent org first. If a swap can't use them (a route
// without fixed-rate coverage, a spend limit reached), it's quoted again at the
// market rate without either.
export const FIXED_RATE = false; // 1:1 between stablecoins, before fees
export const FEE_SPONSORSHIP = false; // the parent org pays the swap fees

export const INPUT_CHAINS: Caip2[] = CHAINS.map((c) => c.caip2).filter(
  (c) => !EXCLUDED_CHAINS.includes(c),
);
