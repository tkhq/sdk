import { BigNumber, ethers } from "ethers";

// Environment
export enum Environment {
  GOERLI = "goerli",
  MAINNET = "mainnet",
}

const MAX_DECIMALS = 4;

// fromReadableAmount converts whole amounts to atomic amounts
export function fromReadableAmount(
  amount: number,
  decimals: number
): BigNumber {
  return ethers.utils.parseUnits(amount.toString(), decimals);
}

// toReadableAmount converts atomic amounts to whole amounts
export function toReadableAmount(
  rawAmount: number | string,
  decimals: number,
  maxDecimals = MAX_DECIMALS
): string {
  return ethers.utils.formatUnits(rawAmount, decimals).slice(0, maxDecimals);
}
