import type { Token, TradeType } from "@uniswap/sdk-core";
import type { Trade } from "@uniswap/v3-sdk";
import { parseUnits, formatUnits } from "ethers";

const MAX_DECIMALS = 4;

export enum TransactionState {
  Failed = "Failed",
  New = "New",
  Rejected = "Rejected",
  Sending = "Sending",
  Sent = "Sent",
}

// fromReadableAmount converts whole amounts to atomic amounts
export function fromReadableAmount(amount: number, decimals: number): bigint {
  return parseUnits(amount.toString(), decimals);
}

// toReadableAmount converts atomic amounts to whole amounts
export function toReadableAmount(rawAmount: number, decimals: number): string {
  return formatUnits(rawAmount, decimals).slice(0, MAX_DECIMALS);
}

export function displayTrade(trade: Trade<Token, Token, TradeType>): string {
  return `${trade.inputAmount.toExact()} ${
    trade.inputAmount.currency.symbol
  } for ${trade.outputAmount.toExact()} ${trade.outputAmount.currency.symbol}`;
}
