import { ethers } from "ethers";

/**
 * Utility functions for paymaster operations
 */

/**
 * Format gas price for display
 */
export function formatGasPrice(gasPrice: bigint): string {
  return `${ethers.formatUnits(gasPrice, "gwei")} gwei`;
}

/**
 * Format ETH amount for display
 */
export function formatEth(amount: bigint): string {
  return `${ethers.formatEther(amount)} ETH`;
}

/**
 * Calculate estimated gas cost for a user operation
 */
export function calculateGasCost(
  callGasLimit: bigint,
  verificationGasLimit: bigint,
  preVerificationGas: bigint,
  maxFeePerGas: bigint
): bigint {
  return (callGasLimit + verificationGasLimit + preVerificationGas) * maxFeePerGas;
}

/**
 * Validate address format
 */
export function isValidAddress(address: string): boolean {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate hex data format
 */
export function isValidHexData(data: string): boolean {
  return ethers.isHexString(data) && data.length % 2 === 0;
}

/**
 * Generate a random nonce for testing
 */
export function generateRandomNonce(): bigint {
  return BigInt(Math.floor(Math.random() * 1000000));
}

/**
 * Create a simple transfer call data
 */
export function createTransferCallData(to: string, value: bigint): string {
  return "0x"; // Simple transfer doesn't need call data
}

/**
 * Create a simple contract call data
 */
export function createContractCallData(methodSignature: string, params: any[]): string {
  const iface = new ethers.Interface([methodSignature]);
  return iface.encodeFunctionData(methodSignature.split("(")[0], params);
}

/**
 * Parse user operation for display
 */
export function parseUserOp(userOp: any) {
  return {
    sender: userOp.sender,
    nonce: userOp.nonce.toString(),
    callGasLimit: userOp.callGasLimit.toString(),
    verificationGasLimit: userOp.verificationGasLimit.toString(),
    preVerificationGas: userOp.preVerificationGas.toString(),
    maxFeePerGas: formatGasPrice(userOp.maxFeePerGas),
    maxPriorityFeePerGas: formatGasPrice(userOp.maxPriorityFeePerGas),
    paymaster: userOp.paymasterAndData.slice(0, 42),
    hasSignature: userOp.signature !== "0x"
  };
}

/**
 * Check if a transaction is likely to succeed based on gas estimation
 */
export async function estimateTransactionSuccess(
  provider: ethers.JsonRpcProvider,
  to: string,
  value: bigint,
  data: string
): Promise<{ success: boolean; gasEstimate?: bigint; error?: string }> {
  try {
    const gasEstimate = await provider.estimateGas({
      to,
      value,
      data
    });
    return { success: true, gasEstimate };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || "Gas estimation failed" 
    };
  }
}

/**
 * Get current network information
 */
export async function getNetworkInfo(provider: ethers.JsonRpcProvider) {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const feeData = await provider.getFeeData();
    
    return {
      chainId: network.chainId.toString(),
      name: network.name,
      blockNumber,
      gasPrice: feeData.gasPrice ? formatGasPrice(feeData.gasPrice) : "Unknown",
      maxFeePerGas: feeData.maxFeePerGas ? formatGasPrice(feeData.maxFeePerGas) : "Unknown",
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? formatGasPrice(feeData.maxPriorityFeePerGas) : "Unknown"
    };
  } catch (error) {
    console.error("Error getting network info:", error);
    return null;
  }
}

/**
 * Wait for a specific number of blocks
 */
export async function waitForBlocks(
  provider: ethers.JsonRpcProvider,
  blockCount: number
): Promise<void> {
  const currentBlock = await provider.getBlockNumber();
  const targetBlock = currentBlock + blockCount;
  
  console.log(`Waiting for ${blockCount} blocks (from ${currentBlock} to ${targetBlock})...`);
  
  return new Promise((resolve) => {
    const checkBlock = async () => {
      const block = await provider.getBlockNumber();
      if (block >= targetBlock) {
        resolve();
      } else {
        setTimeout(checkBlock, 1000);
      }
    };
    checkBlock();
  });
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i === maxRetries - 1) break;
      
      const delay = baseDelay * Math.pow(2, i);
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
