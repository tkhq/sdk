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
  amount: bigint,
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
  amount: bigint,
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
  etherAmount: string,
): ExecutionParams {
  return buildETHTransfer(to, parseEther(etherAmount));
}

/**
 * Packs execution data for the gas station delegate contract.
 * Only packs signature, nonce, and calldata args.
 * The output contract address and ETH amount are now explicit parameters
 * in the execute() function signature, not part of the packed bytes.
 *
 * Packed data format:
 * Layout: [signature(65)][nonce(16)][arguments(variable)]
 * - signature: bytes 0-65 (65 bytes)
 * - nonce: bytes 65-81 (16 bytes, uint128)
 * - arguments: bytes 81 onwards (variable length)
 */
export function packExecutionData({
  signature,
  nonce,
  args,
}: {
  signature: Hex;
  nonce: bigint;
  args: Hex;
}): Hex {
  return concat([
    signature, // 65 bytes
    pad(toHex(nonce), { size: 16 }), // 16 bytes (uint128)
    args, // variable length
  ]);
}
