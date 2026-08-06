import * as path from "path";
import * as dotenv from "dotenv";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  parseAbi,
} from "viem";
import { baseSepolia } from "viem/chains";
import { AaveV3BaseSepolia } from "@bgd-labs/aave-address-book";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export const CAIP2_BASE_SEPOLIA = "eip155:84532";
export const BASESCAN = "https://sepolia.basescan.org";

export function turnkeyClient() {
  return new TurnkeyServerSDK({
    apiBaseUrl: process.env.TURNKEY_BASE_URL!,
    apiPrivateKey: process.env.TURNKEY_API_PRIVATE_KEY!,
    apiPublicKey: process.env.TURNKEY_API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.TURNKEY_ORGANIZATION_ID!,
  }).apiClient();
}

export function signWith(): `0x${string}` {
  const addr = process.env.SIGN_WITH;
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    throw new Error(
      "SIGN_WITH must be a 0x wallet address (see .env.local.example)",
    );
  }
  return addr as `0x${string}`;
}

/**
 * Submit an ETH_SEND_TRANSACTION_V2 activity — an ordered list of 1-50 calls
 * under ONE Turnkey activity — and poll until Turnkey's Gas Station has
 * broadcast it and a transaction hash is available.
 *
 * With `sponsor: true` and more than one call, Turnkey composes the calls into
 * a single atomic EIP-7702 batch transaction and pays the gas. One activity,
 * one policy evaluation, one on-chain transaction.
 */
export async function sendBatch(params: {
  label: string;
  calls: Array<{ to: `0x${string}`; data?: `0x${string}`; value?: string }>;
}): Promise<{ txHash: string }> {
  const client = turnkeyClient();

  console.log(
    `${params.label}: submitting ${params.calls.length} call(s) as ONE activity…`,
  );
  const t0 = Date.now();
  const result = await client.ethSendTransaction({
    from: signWith(),
    caip2: CAIP2_BASE_SEPOLIA,
    sponsor: true, // Gas Station pays gas; >1 call requires sponsor=true (EIP-7702 batch)
    calls: params.calls,
  });

  const statusId = result.sendTransactionStatusId;
  console.log(
    `${params.label}: activity ${result.activity.id} (${Date.now() - t0}ms)`,
  );

  // Poll for the on-chain hash. Gas Station typically lands in a few seconds.
  const deadline = Date.now() + 90_000;
  let delay = 500;
  while (Date.now() < deadline) {
    const status = await client.getSendTransactionStatus({
      sendTransactionStatusId: statusId,
    });
    const txHash = status.eth?.txHash;
    const txStatus = status.txStatus ?? "TX_STATUS_UNKNOWN";

    if (
      txStatus === "TX_STATUS_FAILED" ||
      txStatus === "TX_STATUS_DROPPED" ||
      txStatus === "TX_STATUS_ERROR"
    ) {
      throw new Error(
        `${params.label}: txStatus=${txStatus} txError=${status.txError ?? "?"}`,
      );
    }

    if (txHash) {
      console.log(
        `${params.label}: ${txStatus} in ${Date.now() - t0}ms — ${BASESCAN}/tx/${txHash}`,
      );
      return { txHash };
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 2_000);
  }
  throw new Error(
    `${params.label}: timed out waiting for txHash (statusId ${statusId})`,
  );
}

/**
 * Public RPCs can lag Turnkey's confirmation by a few seconds — wait before
 * reading back state that a just-included transaction changed.
 */
export async function settle(ms = 5_000): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Read the wallet's Aave v3 position (collateral, debt, health factor) plus
 * its liquid USDC balance, and print a one-line summary. Read-only — the
 * write path never touches an RPC (Turnkey signs AND broadcasts).
 */
export async function printPosition(tag: string): Promise<{
  collateralUsd: number;
  debtUsd: number;
}> {
  const client = createPublicClient({ chain: baseSepolia, transport: http() });
  const me = signWith();
  const poolAbi = parseAbi([
    "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  ]);

  const [account, usdcBalance] = await Promise.all([
    client.readContract({
      address: AaveV3BaseSepolia.POOL as `0x${string}`,
      abi: poolAbi,
      functionName: "getUserAccountData",
      args: [me],
    }),
    client.readContract({
      address: AaveV3BaseSepolia.ASSETS.USDC.UNDERLYING as `0x${string}`,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [me],
    }),
  ]);

  const [totalCollateralBase, totalDebtBase, , , , healthFactor] = account;
  // Aave v3 "base" values are USD with 8 decimals.
  const collateralUsd = Number(formatUnits(totalCollateralBase, 8));
  const debtUsd = Number(formatUnits(totalDebtBase, 8));
  const hf =
    totalDebtBase === 0n
      ? "∞"
      : Number(formatUnits(healthFactor, 18)).toFixed(2);

  console.log(
    `[${tag}] collateral $${collateralUsd.toFixed(2)} | debt $${debtUsd.toFixed(2)} | health factor ${hf} | wallet USDC ${formatUnits(usdcBalance, 6)}`,
  );
  return { collateralUsd, debtUsd };
}
