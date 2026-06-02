export const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43"; // Uniswap Universal Router on Base
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export const PERMIT2_ABI = [
  "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
  "function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration)",
];

export const UNIVERSAL_ROUTER_ABI = [
  "function execute(bytes commands, bytes[] inputs) payable",
];

// USDC + WETH on Base mainnet
export const USDC = {
  address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  decimals: 6,
};

export const WETH = {
  address: "0x4200000000000000000000000000000000000006",
  decimals: 18,
};
