export const UNIVERSAL_ROUTER = "0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b";
export const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export const PERMIT2_ABI = [
  "function approve(address token, address spender, uint160 amount, uint48 expiration) external",
  "function allowance(address user, address token, address spender) view returns (uint160 amount, uint48 expiration)"
];

export const UNIVERSAL_ROUTER_ABI = [
  "function execute(bytes commands, bytes[] inputs) payable"
];

export const ERC20_ABI = [
  "function approve(address spender, uint amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint)",
  "function allowance(address owner, address spender) view returns (uint)"
];


// USDC + WETH test tokens on Sepolia
export const USDC = {
  address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", 
  decimals: 6,
};

export const WETH = {
  address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", 
  decimals: 18,
};