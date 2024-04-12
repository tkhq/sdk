import type { Token, TradeType } from "@uniswap/sdk-core";
import type { Trade } from "@uniswap/v3-sdk";
import { BigNumber, ethers } from "ethers";

const MAX_DECIMALS = 4;

export enum TransactionState {
  Failed = "Failed",
  New = "New",
  Rejected = "Rejected",
  Sending = "Sending",
  Sent = "Sent",
}

// fromReadableAmount converts whole amounts to atomic amounts
export function fromReadableAmount(
  amount: number,
  decimals: number
): BigNumber {
  return ethers.utils.parseUnits(amount.toString(), decimals);
}

// toReadableAmount converts atomic amounts to whole amounts
export function toReadableAmount(rawAmount: number, decimals: number): string {
  return ethers.utils.formatUnits(rawAmount, decimals).slice(0, MAX_DECIMALS);
}

export function displayTrade(trade: Trade<Token, Token, TradeType>): string {
  return `${trade.inputAmount.toExact()} ${
    trade.inputAmount.currency.symbol
  } for ${trade.outputAmount.toExact()} ${trade.outputAmount.currency.symbol}`;
}
