import * as path from "path";
import * as dotenv from "dotenv";
import { base } from "viem/chains";
import {
  parseAbi,
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

  const poolReadWriteAbi = parseAbi([
    "function withdraw(address asset,uint256 amount,address to) returns (uint256)",
  ]);

  // withdraw 0.1 USDC
  const { request: withdrawReq } = await publicClient.simulateContract({
    address: AAVE_POOL as `0x${string}`,
    abi: poolReadWriteAbi,
    functionName: "withdraw",
    args: [
      USDC_ADDRESS,
      parseUnits("0.1", 6),
      (walletClient.account as Account).address,
    ],
    account: walletClient.account as Account,
  });

  // the USDC transfer path & proxy layers sometimes make estimateGas under-shoot
  // adding a buffer to avoid occasional out-of-gas errors
  const gas = await publicClient.estimateContractGas({
    address: AAVE_POOL as `0x${string}`,
    abi: poolReadWriteAbi,
    functionName: "withdraw",
    args: [
      USDC_ADDRESS,
      parseUnits("0.1", 6),
      (walletClient.account as Account).address,
    ],
    account: walletClient.account as Account,
  });

  const gasWithBuffer = (gas * 130n) / 100n;

  const withdrawHash = await walletClient.writeContract({
    ...withdrawReq,
    gas: gasWithBuffer,
  });
  const receiptWithdraw = await publicClient.waitForTransactionReceipt({
    hash: withdrawHash,
  });

  console.log(
    "Withdraw transaction:",
    `https://basescan.org/tx/${withdrawHash}`,
    receiptWithdraw.status,
  );
}
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
