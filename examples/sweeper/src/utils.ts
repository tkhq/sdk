import { ethers } from "ethers";
import { SupportedChainId, Token } from "@uniswap/sdk-core";

// Environment

export enum Environment {
  GOERLI = "goerli",
  MAINNET = "mainnet",
}

// Currencies and Tokens

export const WETH_TOKEN_MAINNET = new Token(
  SupportedChainId.MAINNET,
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  18,
  "WETH",
  "Wrapped Ether"
);

export const WETH_TOKEN_GOERLI = new Token(
  SupportedChainId.GOERLI,
  "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  18,
  "WETH",
  "Wrapped Ether"
);

export const USDC_TOKEN_MAINNET = new Token(
  SupportedChainId.MAINNET,
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  6,
  "USDC",
  "USD//C"
);

export const USDC_TOKEN_GOERLI = new Token(
  SupportedChainId.GOERLI,
  "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
  6,
  "USDC",
  "USD//C"
);

export const UNI_TOKEN_MAINNET = new Token(
  SupportedChainId.MAINNET,
  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  18,
  "UNI",
  "Uniswap"
);

export const UNI_TOKEN_GOERLI = new Token(
  SupportedChainId.GOERLI,
  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  18,
  "UNI",
  "Uniswap"
);

// ABIs

export const ERC20_ABI = [
  // Read-Only Functions
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",

  // Authenticated Functions
  "function transfer(address to, uint amount) returns (bool)",
  "function approve(address _spender, uint256 _value) returns (bool)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint amount)",
];

const MAX_DECIMALS = 4;

// fromReadableAmount converts whole amounts to atomic amounts
export function fromReadableAmount(amount: number, decimals: number): bigint {
  return ethers.parseUnits(amount.toString(), decimals);
}

// toReadableAmount converts atomic amounts to whole amounts
export function toReadableAmount(
  rawAmount: number | string,
  decimals: number,
  maxDecimals = MAX_DECIMALS
): string {
  return ethers.formatUnits(rawAmount, decimals).slice(0, maxDecimals);
}
