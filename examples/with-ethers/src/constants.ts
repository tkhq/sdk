// This file stores web3 related constants such as addresses, token definitions, ETH currency references and ABIs

import { SupportedChainId, Token } from "@uniswap/sdk-core";
import wethContractABI from "./abi/weth-contract-abi.json";

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

// ABIs

export const WETH_ABI = wethContractABI;
