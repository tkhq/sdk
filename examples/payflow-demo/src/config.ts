export const SEPOLIA_USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

export const SEPOLIA_CAIP2 = "eip155:11155111";

export const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

export const DERIVATION_PATH_BASE = "m/44'/60'/0'/0";

export const MERCHANT_COUNT = 3;

export const TRANSFER_SELECTOR = "0xa9059cbb";

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

export const GENERATED_FILE = "payflow.generated.json";
