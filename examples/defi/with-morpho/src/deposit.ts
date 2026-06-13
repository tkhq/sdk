import * as path from "path";
import * as dotenv from "dotenv";
import { base } from "viem/chains";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import {
  createWalletClient,
  http,
  type Account,
  erc20Abi,
  createPublicClient,
  parseAbi,
  parseUnits,
} from "viem";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MORPHO_VAULT_ADDRESS = process.env.MORPHO_VAULT_ADDRESS!;
const USDC_ADDRESS = process.env.USDC_ADDRESS!;

async function main() {
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: process.env.TURNKEY_BASE_URL!,
    apiPrivateKey: process.env.NONROOT_API_PRIVATE_KEY!,
    apiPublicKey: process.env.NONROOT_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  });

  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: process.env.TURNKEY_ORGANIZATION_ID!,
    signWith: process.env.SIGN_WITH!,
  });

  const client = createWalletClient({
    account: turnkeyAccount as Account,
    chain: base,
    transport: http(
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
  });

  const publicClient = createPublicClient({
    transport: http(
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
    chain: base,
  });

  // Approve the vault to spend for 10 USDC, use maxUint256 if you want the max token approval
  const { request: approveReq } = await publicClient.simulateContract({
    abi: erc20Abi,
    address: USDC_ADDRESS as `0x${string}`,
    functionName: "approve",
    chain: base,
    args: [MORPHO_VAULT_ADDRESS as `0x${string}`, parseUnits("10", 6)],
    account: client.account,
  });

  const approveHash = await client.writeContract(approveReq);

  console.log("Approve transaction:", `https://basescan.org/tx/${approveHash}`);

  // Deposit USDC into vault
  const vaultAbi = parseAbi([
    "function deposit(uint256 assets, address receiver) external returns (uint256 shares)",
  ]);

  const { request: depositReq } = await publicClient.simulateContract({
    abi: vaultAbi,
    address: MORPHO_VAULT_ADDRESS as `0x${string}`,
    functionName: "deposit",
    args: [parseUnits("0.5", 6), (turnkeyAccount as Account).address],
    account: turnkeyAccount as Account,
  });
  const depositHash = await client.writeContract(depositReq);

  console.log("Deposit transaction:", `https://basescan.org/tx/${depositHash}`);
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
