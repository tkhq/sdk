import {
  encodeFunctionData,
  parseEther,
  createPublicClient,
  http,
  type Address,
  type Chain,
} from "viem";

// Utility functions
export function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

export function createPublicClientForChain(chain: Chain, rpcUrl: string) {
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

export function formatTransferDetails(
  amount: bigint,
  decimals: number,
  symbol: string,
  from: string,
  to: string
): string {
  const formattedAmount = Number(amount) / Math.pow(10, decimals);
  return `${formattedAmount} ${symbol} from ${from.slice(0, 10)}... to ${to.slice(0, 10)}...`;
}

// ERC20 ABI for token transfers
export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
] as const;

/**
 * Parameters for executing an action through the gas station
 * Maps directly to the gas station contract's execute function
 */
export interface ExecutionParams {
  outputContract: `0x${string}`;
  callData: `0x${string}`;
  value?: bigint;
}

/**
 * Helper utilities for building common execution parameters
 * These make it easy to construct the params for common operations
 */
export class GasStationHelpers {
  /**
   * Build parameters for an ERC20 token transfer
   */
  static buildTokenTransfer(
    token: Address,
    to: Address,
    amount: bigint
  ): ExecutionParams {
    return {
      outputContract: token,
      callData: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to, amount],
      }),
      value: 0n,
    };
  }

  /**
   * Build parameters for a native ETH transfer
   */
  static buildETHTransfer(to: Address, amount: bigint): ExecutionParams {
    return {
      outputContract: to,
      callData: "0x",
      value: amount,
    };
  }

  /**
   * Build parameters for an ERC20 token approval
   */
  static buildTokenApproval(
    token: Address,
    spender: Address,
    amount: bigint
  ): ExecutionParams {
    return {
      outputContract: token,
      callData: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [spender, amount],
      }),
      value: 0n,
    };
  }

  /**
   * Build parameters for a generic contract call
   */
  static buildContractCall(params: {
    contract: Address;
    abi: readonly any[] | any[];
    functionName: string;
    args: any[];
    value?: bigint;
  }): ExecutionParams {
    return {
      outputContract: params.contract,
      callData: encodeFunctionData({
        abi: params.abi,
        functionName: params.functionName,
        args: params.args,
      }),
      value: params.value ?? 0n,
    };
  }

  /**
   * Convenience: Build ETH transfer with ether string parsing
   */
  static buildETHTransferFromEther(
    to: Address,
    etherAmount: string
  ): ExecutionParams {
    return this.buildETHTransfer(to, parseEther(etherAmount));
  }
}
