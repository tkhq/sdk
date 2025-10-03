import type { Chain, WalletClient, Account, Transport } from "viem";
import { base, mainnet, sepolia } from "viem/chains";

// Default contract addresses (deterministically deployed across all chains)
export const DEFAULT_DELEGATE_CONTRACT: `0x${string}` =
  "0x33619C1BfB3956a00DDA34FdbF7c3138B6244Aa2";
export const DEFAULT_EXECUTION_CONTRACT: `0x${string}` =
  "0xe511AD0a281C10b8408381E2Ab8525abE587827b";

// Type definitions
export interface GasStationConfig {
  walletClient: WalletClient<Transport, Chain, Account>;
  delegateContract?: `0x${string}`;
  executionContract?: `0x${string}`;
  explorerUrl: string;
}

export interface ChainPreset {
  chain: Chain;
  rpcUrl: string;
  explorerUrl: string;
  delegateContract?: `0x${string}`;
  executionContract?: `0x${string}`;
  tokens?: {
    USDC?: `0x${string}`;
    [key: string]: `0x${string}` | undefined;
  };
}

export interface ContractCallParams {
  contract: `0x${string}`;
  abi: readonly any[] | any[];
  functionName: string;
  args: any[];
  value?: bigint;
}

export interface ExecutionIntent {
  nonce: bigint;
  outputContract: `0x${string}`;
  ethAmount: bigint;
  callData: `0x${string}`;
  signature: `0x${string}`;
  eoaAddress: `0x${string}`;
}

// Chain preset configurations
export const CHAIN_PRESETS: Record<string, ChainPreset> = {
  BASE_MAINNET: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || "",
    explorerUrl: "https://basescan.org",
    tokens: {
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
  },
  ETHEREUM_MAINNET: {
    chain: mainnet,
    rpcUrl: process.env.ETH_RPC_URL || "",
    explorerUrl: "https://etherscan.io",
    tokens: {
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
  },
  SEPOLIA: {
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC_URL || "",
    explorerUrl: "https://sepolia.etherscan.io",
  },
};

/**
 * Create a custom preset with validation
 */
export function createCustomPreset(config: ChainPreset): ChainPreset {
  if (!config.chain) {
    throw new Error("Chain configuration is required");
  }
  if (!config.rpcUrl) {
    throw new Error("RPC URL is required");
  }
  return config;
}

/**
 * Get a preset with optional environment variable overrides
 */
export function getPreset(
  presetName: keyof typeof CHAIN_PRESETS,
  overrides?: Partial<ChainPreset>,
): ChainPreset {
  const preset = CHAIN_PRESETS[presetName];
  if (!preset) {
    throw new Error(
      `Unknown preset: ${presetName}. Available: ${Object.keys(CHAIN_PRESETS).join(", ")}`,
    );
  }
  return { ...preset, ...overrides };
}
