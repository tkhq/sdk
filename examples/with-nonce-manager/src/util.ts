import { ethers } from "ethers";
import {
  DEFAULT_MAX_FEE_PER_GAS,
  DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  DEFAULT_GAS_MULTIPLIER,
} from "./constants";

export function sleep(milliseconds: number) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

// Helper to update a transaction with increased gas fee params
export async function getUpdatedTransaction(
  provider: ethers.providers.Provider,
  transaction: ethers.providers.TransactionRequest
) {
  const feeData = await provider.getFeeData();

  const maxFee = maxBigNumber([
    feeData.maxFeePerGas!,
    transaction.maxFeePerGas,
    DEFAULT_MAX_FEE_PER_GAS,
  ]);
  const maxPriorityFee = maxBigNumber([
    feeData.maxPriorityFeePerGas!,
    transaction.maxPriorityFeePerGas,
    DEFAULT_MAX_PRIORITY_FEE_PER_GAS,
  ]);

  const maxFeeMultiplied = (
    parseFloat(maxFee.toString()) *
    parseFloat(DEFAULT_GAS_MULTIPLIER.toString())
  ).toFixed(0);
  const maxPriorityFeeMultiplied = (
    parseFloat(maxPriorityFee.toString()) *
    parseFloat(DEFAULT_GAS_MULTIPLIER.toString())
  ).toFixed(0);

  return {
    ...transaction,
    maxFeePerGas: maxFeeMultiplied,
    maxPriorityFeePerGas: maxPriorityFeeMultiplied,
  };
}

// Helper to get the maximum BigNumber in a given array
export function maxBigNumber(
  arr: (ethers.BigNumberish | undefined)[]
): ethers.BigNumber {
  let max = ethers.BigNumber.from(0);

  for (let i = 0; i < arr.length; i++) {
    const value = ethers.BigNumber.from(arr[i] || 0);
    if (value.gt(max)) {
      max = value;
    }
  }

  return max;
}

export function print(header: string, body: string): void {
  console.log(`${header}\n\t${body}\n`);
}

export function refineNonNull<T>(
  input: T | null | undefined,
  errorMessage?: string
): T {
  if (input == null) {
    throw new Error(errorMessage ?? `Unexpected ${JSON.stringify(input)}`);
  }

  return input;
}
