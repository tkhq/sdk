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
  outputContract: Hex;
  callData: Hex;
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
 * Packs signature, nonce, deadline, and calldata args.
 * The output contract address and ETH amount are explicit parameters
 * in the execute() function signature, not part of the packed bytes.
 *
 * Packed data format:
 * Layout: [signature(65)][nonce(16)][deadline(4)][arguments(variable)]
 * - signature: bytes 0-64 (65 bytes)
 * - nonce: bytes 65-80 (16 bytes, uint128)
 * - deadline: bytes 81-84 (4 bytes, uint32)
 * - arguments: bytes 85 onwards (variable length)
 */
export function packExecutionData({
  signature,
  nonce,
  deadline,
  args,
}: {
  signature: Hex;
  nonce: bigint;
  deadline: number;
  args: Hex;
}): Hex {
  return concat([
    signature, // 65 bytes
    pad(toHex(nonce), { size: 16 }), // 16 bytes (uint128)
    pad(toHex(deadline), { size: 4 }), // 4 bytes (uint32)
    args, // variable length
  ]);
}

/**
 * Packs session signature data for the reimbursable gas station.
 * Used to authorize USDC transfers for gas payment.
 *
 * Packed data format:
 * Layout: [signature(65)][nonce(16)][deadline(4)]
 * - signature: bytes 0-64 (65 bytes)
 * - nonce: bytes 65-80 (16 bytes, uint128)
 * - deadline: bytes 81-84 (4 bytes, uint32)
 */
export function packSessionSignature({
  signature,
  nonce,
  deadline,
}: {
  signature: Hex;
  nonce: bigint;
  deadline: number;
}): Hex {
  return concat([
    signature, // 65 bytes
    pad(toHex(nonce), { size: 16 }), // 16 bytes (uint128)
    pad(toHex(deadline), { size: 4 }), // 4 bytes (uint32)
  ]);
}
