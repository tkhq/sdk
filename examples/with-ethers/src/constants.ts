// This file stores web3 related constants such as addresses, token definitions, ETH currency references and ABIs

import { SupportedChainId, Token } from "@uniswap/sdk-core";
import uniV3UniversalRouterContractABI from "./abi/univ3-universal-router-contract-abi.json";
import wethContractABI from "./abi/weth-contract-abi.json";

// Contract Addresses

export const POOL_FACTORY_CONTRACT_ADDRESS =
  "0x1F98431c8aD98523631AE4a59f267346ea31F984"; // for both mainnet and goerli
export const QUOTER_CONTRACT_ADDRESS =
  "0x61fFE014bA17989E743c5F6cB21bF9697530B21e"; // for both mainnet and goerli
export const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // for both mainnet and goerli
export const UNI_V3_UNIVERSAL_ROUTER_CONTRACT_ADDRESS_GOERLI =
  "0x4648a43b2c14da09fdf82b161150d3f634f40491";

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
  SupportedChainId.MAINNET,
  "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
  6,
  "USDC",
  "USD//C"
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

export const WETH_ABI = wethContractABI;

export const UNI_V3_UNIVERSAL_ROUTER_CONTRACT_ABI =
  uniV3UniversalRouterContractABI;

// Transactions

export const MAX_FEE_PER_GAS = 100000000000;
export const MAX_PRIORITY_FEE_PER_GAS = 100000000000;
export const TOKEN_AMOUNT_TO_APPROVE_FOR_TRANSFER = 2000;
