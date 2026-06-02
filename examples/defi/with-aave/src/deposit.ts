import * as path from "path";
import * as dotenv from "dotenv";
import { base } from "viem/chains";
import {
  parseAbi,
  erc20Abi,
  parseUnits,
  createWalletClient,
  http,
  createPublicClient,
  type Account,
} from "viem";
import { createAccount } from "@turnkey/viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { AaveV3Base } from "@bgd-labs/aave-address-book";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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

  const walletClient = createWalletClient({
    account: turnkeyAccount as Account,
    chain: base,
    transport: http(
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
  });

  const publicClient = createPublicClient({
    chain: base,
    transport: http(
      `https://base-mainnet.infura.io/v3/${process.env.INFURA_API_KEY!}`,
    ),
  });

  // Pull addresses from Aave Address Book (Base)
  const USDC_ADDRESS = AaveV3Base.ASSETS.USDC.UNDERLYING;
  const AAVE_POOL = AaveV3Base.POOL;

  // Approve Pool to spend 10 USDC
  const { request: approveReq } = await publicClient.simulateContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "approve",
    args: [AAVE_POOL as `0x${string}`, parseUnits("10", 6)], // USDC has 6 decimals
    account: walletClient.account,
  });

  const approveHash = await walletClient.writeContract(approveReq);
  const receiptApprove = await publicClient.waitForTransactionReceipt({
    hash: approveHash,
  });

  console.log(
    "Approve transaction:",
    `https://basescan.org/tx/${approveHash}`,
    receiptApprove.status,
  );

  // Supply 0.5 USDC
  const poolAbi = parseAbi([
    "function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)",
  ]);

  const { request: supplyReq } = await publicClient.simulateContract({
    address: AAVE_POOL as `0x${string}`,
    abi: poolAbi,
    functionName: "supply",
    args: [
      USDC_ADDRESS,
      parseUnits("0.5", 6),
      (walletClient.account as Account).address,
      0,
    ],
    account: walletClient.account as Account,
  });

  // the USDC transfer path & proxy layers sometimes make estimateGas under-shoot
  // adding a buffer to avoid occasional out-of-gas errors
  const gas = await publicClient.estimateContractGas({
    address: AAVE_POOL as `0x${string}`,
    abi: poolAbi,
    functionName: "supply",
    args: [
      USDC_ADDRESS,
      parseUnits("0.5", 6),
      (walletClient.account as Account).address,
      0,
    ],
    account: walletClient.account as Account,
  });

  const gasWithBuffer = (gas * 130n) / 100n;

  const supplyHash = await walletClient.writeContract({
    ...supplyReq,
    gas: gasWithBuffer,
  });
  const receiptSupply = await publicClient.waitForTransactionReceipt({
    hash: supplyHash,
  });

  console.log(
    "Supply transaction:",
    `https://basescan.org/tx/${supplyHash}`,
    receiptSupply.status,
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
