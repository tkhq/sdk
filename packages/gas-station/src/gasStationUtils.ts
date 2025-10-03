import {
  encodeFunctionData,
  parseEther,
  createPublicClient,
  http,
  type Address,
  type Chain,
  type Hex,
  concat,
  toHex,
  pad,
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
 * Build parameters for an ERC20 token transfer
 */
export function buildTokenTransfer(
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
export function buildETHTransfer(to: Address, amount: bigint): ExecutionParams {
  return {
    outputContract: to,
    callData: "0x",
    value: amount,
  };
}

/**
 * Build parameters for an ERC20 token approval
 */
export function buildTokenApproval(
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
export function buildContractCall(params: {
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
export function buildETHTransferFromEther(
  to: Address,
  etherAmount: string
): ExecutionParams {
  return buildETHTransfer(to, parseEther(etherAmount));
}

/**
 * Packs execution data for the delegate contract's execute function.
 * Layout: [signature(65)][nonce(16)][address(20)][value(32)][arguments]
 *
 * This matches the parsing logic in TKGasDelegate.execute():
 * - signature: bytes 0-65
 * - nonce: bytes 65-81 (uint128)
 * - address (to): bytes 81-101 (20 bytes)
 * - value: bytes 101-133 (uint256, 32 bytes)
 * - arguments: bytes 133 onwards
 */
export function packExecutionData(
  signature: Hex,
  nonce: bigint,
  to: Address,
  value: bigint,
  arguments_: Hex
): Hex {
  return concat([
    signature, // 65 bytes
    pad(toHex(nonce), { size: 16 }), // 16 bytes (uint128)
    to, // 20 bytes
    pad(toHex(value), { size: 32 }), // 32 bytes (uint256)
    arguments_, // variable length
  ]);
}

/**
 * Packs execution data for the delegate contract's executeNoValue function.
 * Layout: [signature(65)][nonce(16)][address(20)][arguments]
 *
 * This matches the parsing logic in TKGasDelegate.executeNoValue():
 * - signature: bytes 0-65
 * - nonce: bytes 65-81 (uint128)
 * - address (to): bytes 81-101 (20 bytes)
 * - arguments: bytes 101 onwards
 */
export function packExecutionDataNoValue(
  signature: Hex,
  nonce: bigint,
  to: Address,
  arguments_: Hex
): Hex {
  return concat([
    signature, // 65 bytes
    pad(toHex(nonce), { size: 16 }), // 16 bytes (uint128)
    to, // 20 bytes
    arguments_, // variable length
  ]);
}
