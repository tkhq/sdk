import type { Provider, TransactionRequest } from "ethers";
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
  provider: Provider,
  transaction: TransactionRequest
) {
  const feeData = await provider.getFeeData();

  // Custom function to find the maximum of bigint values
  const maxBigInt = (values: bigint[]): bigint =>
    values.reduce(
      (max: bigint, current: bigint) => (current > max ? current : max),
      0n
    );

  const maxFee = maxBigInt([
    BigInt(feeData.maxFeePerGas || 0),
    BigInt(transaction.maxFeePerGas || 0),
    BigInt(DEFAULT_MAX_FEE_PER_GAS),
  ]);

  const maxPriorityFee = maxBigInt([
    BigInt(feeData.maxPriorityFeePerGas || 0),
    BigInt(transaction.maxPriorityFeePerGas || 0),
    BigInt(DEFAULT_MAX_PRIORITY_FEE_PER_GAS),
  ]);

  const multiplier = BigInt(
    Math.round(parseFloat(DEFAULT_GAS_MULTIPLIER.toString()) * 100)
  );

  const maxFeeMultiplied = (maxFee * multiplier) / 100n;
  const maxPriorityFeeMultiplied = (maxPriorityFee * multiplier) / 100n;

  return {
    ...transaction,
    maxFeePerGas: maxFeeMultiplied,
    maxPriorityFeePerGas: maxPriorityFeeMultiplied,
  };
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
