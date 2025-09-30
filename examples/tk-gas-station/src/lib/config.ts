import type { Chain, WalletClient, Account, Transport } from "viem";
import type { Turnkey } from "@turnkey/sdk-server";
import { base, mainnet, sepolia } from "viem/chains";

// Type definitions
export interface GasStationConfig {
  turnkeyClient: Turnkey;
  organizationId: string;
  eoaAddress: `0x${string}`;
  paymasterAddress: `0x${string}`;
  delegateContract: `0x${string}`;
  executionContract: `0x${string}`;
  chain: Chain;
  rpcUrl: string;
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

export interface TransferParams {
  token?: `0x${string}` | "ETH";
  to: `0x${string}`;
  amount: bigint;
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

export interface GasStationClients {
  eoaWalletClient: WalletClient<Transport, Chain, Account>;
  paymasterWalletClient: WalletClient<Transport, Chain, Account>;
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
  overrides?: Partial<ChainPreset>
): ChainPreset {
  const preset = CHAIN_PRESETS[presetName];
  if (!preset) {
    throw new Error(
      `Unknown preset: ${presetName}. Available: ${Object.keys(CHAIN_PRESETS).join(", ")}`
    );
  }
  return { ...preset, ...overrides };
}
