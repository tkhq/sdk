// Minimal ERC-20 ABI
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

// Wrapped ETH (Sepolia)
export const WETH_SEPOLIA = {
  chainId: 11155111,
  address: "0xdd13E55209Fd76AfE204dBda4007C227904f0a81",
  decimals: 18,
  symbol: "WETH",
  name: "Wrapped Ether",
};

// USDC (Sepolia testnet)
export const USDC_SEPOLIA = {
  chainId: 11155111,
  address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  decimals: 6,
  symbol: "USDC",
  name: "USD Coin",
};
