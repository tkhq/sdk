import type { Chain, WalletClient, Account, Transport, Hex } from "viem";

import { base, mainnet, sepolia } from "viem/chains";

// Default contract addresses (deterministically deployed across all chains)
export const DEFAULT_DELEGATE_CONTRACT: Hex =
  "0x000066a00056CD44008768E2aF00696e19A30084";
export const DEFAULT_EXECUTION_CONTRACT: Hex =
  "0x00000000008c57a1CE37836a5e9d36759D070d8c";

// Type definitions
export interface GasStationConfig {
  walletClient: WalletClient<Transport, Chain, Account>;
  delegateContract?: Hex;
  executionContract?: Hex;
  defaultGasLimit?: bigint;
}

export interface ChainPreset {
  chain: Chain;
  rpcUrl: string;
  delegateContract?: Hex;
  executionContract?: Hex;
  tokens?: {
    USDC?: Hex;
    [key: string]: Hex | undefined;
  };
}

export interface ContractCallParams {
  contract: Hex;
  abi: readonly any[] | any[];
  functionName: string;
  args: any[];
  value?: bigint;
}

export interface ExecutionIntent {
  nonce: bigint;
  deadline: number;
  outputContract: Hex;
  ethAmount: bigint; // amount of ETH to transfer in wei
  callData: Hex;
  signature: Hex;
  eoaAddress: Hex;
}

export interface ApprovalExecutionIntent extends ExecutionIntent {
  erc20Address: Hex; // The ERC20 token to approve
  spender: Hex; // The address to approve for spending
  approveAmount: bigint; // The amount to approve
}

// Chain preset configurations
export const CHAIN_PRESETS: Record<string, ChainPreset> = {
  BASE_MAINNET: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || "",
    tokens: {
      USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    },
  },
  ETHEREUM_MAINNET: {
    chain: mainnet,
    rpcUrl: process.env.ETH_RPC_URL || "",
    tokens: {
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
  },
  SEPOLIA: {
    chain: sepolia,
    rpcUrl: process.env.SEPOLIA_RPC_URL || "",
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
