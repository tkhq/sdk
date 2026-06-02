// Minimal ERC-20 ABI
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export type TokenConfig = {
  address: string;
  decimals: number;
  symbol: string;
  name: string;
};

export type SupportedNetwork = "sepolia" | "base";

export type NetworkConfig = {
  label: string;
  caip2: string;
  rpcUrl: string;
  explorerBaseUrl: string;
  tokens: TokenConfig[];
};

export const NETWORKS: Record<SupportedNetwork, NetworkConfig> = {
  sepolia: {
    label: "Ethereum Sepolia",
    caip2: "eip155:11155111",
    rpcUrl:
      process.env.SEPOLIA_RPC_URL ??
      "https://ethereum-sepolia-rpc.publicnode.com",
    explorerBaseUrl: "https://sepolia.etherscan.io",
    tokens: [
      {
        address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        decimals: 6,
        symbol: "USDC",
        name: "USD Coin",
      },
      {
        address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
        decimals: 18,
        symbol: "WETH",
        name: "Wrapped Ether",
      },
    ],
  },
  base: {
    label: "Base Mainnet",
    caip2: "eip155:8453",
    rpcUrl: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
    explorerBaseUrl: "https://basescan.org",
    tokens: [
      {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        symbol: "USDC",
        name: "USD Coin",
      },
      {
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        symbol: "WETH",
        name: "Wrapped Ether",
      },
    ],
  },
};
