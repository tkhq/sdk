import * as path from "path";
import * as dotenv from "dotenv";
import type { v1EarnDepositIntent, v1EarnProvider } from "@turnkey/sdk-server";

// Load `.env.local` here, in the first module that reads process.env at import
// time. Imports are hoisted, so a dotenv.config() placed before an import in
// another module would still run after this file's constants are evaluated.
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Chain-specific knowledge for the demo, keyed by the CAIP-2 id in CHAIN_CAIP2.
// Everything else in the example reads from here so the step scripts stay
// chain-agnostic: the same deposit/withdraw flow runs on Base (Morpho, Aave)
// and on Solana (Kamino).

export type ChainCaip2 = v1EarnDepositIntent["caip2"];

// Canonical Solana CAIP-2 ids. The API also accepts the "solana:mainnet" and
// "solana:devnet" aliases and normalizes them to these.
export const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
export const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

const SOLANA_ALIASES: Record<string, string> = {
  "solana:mainnet": SOLANA_MAINNET,
  "solana:devnet": SOLANA_DEVNET,
};

// normalizeCaip2 maps Solana aliases to their canonical id; EVM ids pass through.
export function normalizeCaip2(caip2: string): string {
  return SOLANA_ALIASES[caip2] ?? caip2;
}

export function isSolana(caip2: string): boolean {
  return caip2.startsWith("solana:");
}

type ChainInfo = {
  name: string;
  // USDC on this chain, as a CAIP-19 id; the catalog filter default.
  usdcCaip19?: string;
  // Explorer transaction URL, with {hash} as the placeholder.
  explorerTx?: string;
  // Public JSON-RPC endpoint used by the on-chain helpers (transfer, name lookup).
  rpcUrl?: string;
};

const CHAINS: Record<string, ChainInfo> = {
  "eip155:1": {
    name: "Ethereum",
    usdcCaip19: "eip155:1/erc20:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    explorerTx: "https://etherscan.io/tx/{hash}",
  },
  "eip155:8453": {
    name: "Base",
    usdcCaip19: "eip155:8453/erc20:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorerTx: "https://basescan.org/tx/{hash}",
    rpcUrl: "https://mainnet.base.org",
  },
  "eip155:42161": {
    name: "Arbitrum",
    usdcCaip19: "eip155:42161/erc20:0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    explorerTx: "https://arbiscan.io/tx/{hash}",
  },
  "eip155:137": {
    name: "Polygon",
    usdcCaip19: "eip155:137/erc20:0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    explorerTx: "https://polygonscan.com/tx/{hash}",
  },
  "eip155:56": {
    name: "BNB Chain",
    explorerTx: "https://bscscan.com/tx/{hash}",
  },
  "eip155:10": {
    name: "OP Mainnet",
    explorerTx: "https://optimistic.etherscan.io/tx/{hash}",
  },
  [SOLANA_MAINNET]: {
    name: "Solana",
    usdcCaip19: `${SOLANA_MAINNET}/token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`,
    explorerTx: "https://explorer.solana.com/tx/{hash}",
    rpcUrl: "https://api.mainnet-beta.solana.com",
  },
  [SOLANA_DEVNET]: {
    name: "Solana devnet",
    // Circle's devnet USDC (faucet.circle.com), the mint behind Kamino's devnet
    // USDC reserve.
    usdcCaip19: `${SOLANA_DEVNET}/token:4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`,
    explorerTx: "https://explorer.solana.com/tx/{hash}?cluster=devnet",
    rpcUrl: "https://api.devnet.solana.com",
  },
};

export const CHAIN_CAIP2 = normalizeCaip2(
  process.env.CHAIN_CAIP2 || "eip155:8453",
) as ChainCaip2;

export const IS_SOLANA = isSolana(CHAIN_CAIP2);

const chain: ChainInfo = CHAINS[CHAIN_CAIP2] ?? { name: CHAIN_CAIP2 };

// Underlying-asset filter for the vault catalog: ASSET_CAIP19 from env, else
// USDC on the selected chain.
export const ASSET_CAIP19: string = (() => {
  const fromEnv = process.env.ASSET_CAIP19;
  if (fromEnv) return fromEnv;
  if (chain.usdcCaip19) return chain.usdcCaip19;
  throw new Error(
    `no default asset for ${CHAIN_CAIP2}; set ASSET_CAIP19 in .env.local`,
  );
})();

// Provider to filter the catalog by: EARN_PROVIDER from env, else Kamino on
// Solana and Morpho on EVM.
export const EARN_PROVIDER = (process.env.EARN_PROVIDER ||
  (IS_SOLANA
    ? "EARN_PROVIDER_KAMINO"
    : "EARN_PROVIDER_MORPHO")) as v1EarnProvider;

// RPC endpoint for the on-chain helpers: SOLANA_RPC_URL / EVM_RPC_URL from env,
// else the chain's public endpoint.
export const RPC_URL: string | undefined =
  (IS_SOLANA ? process.env.SOLANA_RPC_URL : process.env.EVM_RPC_URL) ||
  chain.rpcUrl;

// Kamino's catalog API covers mainnet only; on devnet the reserve must be pinned.
export const CATALOG_AVAILABLE = CHAIN_CAIP2 !== SOLANA_DEVNET;

// explorerLink renders a transaction hash (or Solana signature) as an explorer
// URL, falling back to the raw hash on chains without a known explorer.
export function explorerLink(hash: string): string {
  return chain.explorerTx ? chain.explorerTx.replace("{hash}", hash) : hash;
}

// chainName renders a CAIP-2 id (or the chain part of a CAIP-19 id) as a
// human-readable name, keeping the raw id alongside.
export function chainName(caip: string | undefined): string {
  if (!caip) return "unknown chain";

  const caip2 = normalizeCaip2(caip.split("/")[0]!);

  return `${CHAINS[caip2]?.name ?? caip2} (${caip2})`;
}

// sameAddress compares two addresses: case-insensitive for EVM hex, exact for
// Solana base58 (where case is significant).
export function sameAddress(
  a: string | undefined,
  b: string | undefined,
): boolean {
  if (!a || !b) return false;
  if (isSolana(CHAIN_CAIP2)) return a === b;
  return a.toLowerCase() === b.toLowerCase();
}

// assetAddress is the token address or mint from a CAIP-19 id
// ("eip155:8453/erc20:0x..." or "solana:.../token:<mint>").
export function assetAddress(caip19: string): string {
  const asset = caip19.split("/")[1] ?? "";
  return asset.split(":")[1] ?? "";
}
