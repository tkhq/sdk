/**
 * USDC → WETH Swap Example using Turnkey Gas Station
 *
 * This example demonstrates a gasless token swap using the Gas Station pattern
 * with EIP-7702 authorization. It's ideal for users who hold USDC but no ETH.
 *
 * Flow (2 transactions total):
 *   1. approveThenExecute: Atomically approves USDC to Permit2 AND sets up
 *      Permit2 allowance for Universal Router (combines 2 approvals into 1 tx)
 *   2. execute: Performs the actual swap via Uniswap Universal Router
 *
 * The paymaster pays for all gas - the user only signs intents.
 *
 * Prerequisites:
 *   - EOA wallet with USDC balance on Base mainnet
 *   - Paymaster wallet with ETH for gas
 *   - Both wallets accessible via Turnkey
 *
 * Usage:
 *   pnpm tsx src/swapUSDCForETH.ts [--amount <USDC_AMOUNT>]
 *
 * Environment variables required (in .env.local):
 *   - BASE_URL: Turnkey API base URL
 *   - API_PRIVATE_KEY: Turnkey API private key
 *   - API_PUBLIC_KEY: Turnkey API public key
 *   - ORGANIZATION_ID: Turnkey organization ID
 *   - EOA_ADDRESS: User wallet address (holds USDC)
 *   - PAYMASTER_ADDRESS: Paymaster wallet address (pays gas)
 *   - BASE_RPC_URL: Base mainnet RPC endpoint
 */

import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseArgs } from "node:util";
import {
  parseUnits,
  formatUnits,
  createWalletClient,
  http,
  encodeAbiParameters,
  encodePacked,
  type Hex,
  concat,
  toHex,
} from "viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { GasStationClient, CHAIN_PRESETS } from "@turnkey/gas-station";
import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";
import { print } from "./utils";

// ============================================================================
// Configuration
// ============================================================================

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Parse CLI arguments
const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    amount: {
      type: "string",
      short: "a",
      default: "0.10",
    },
  },
});

const SWAP_AMOUNT_USDC = args.amount!;

// Environment validation
const envSchema = z.object({
  BASE_URL: z.string().url("BASE_URL must be a valid Turnkey API URL"),
  API_PRIVATE_KEY: z.string().min(1, "API_PRIVATE_KEY is required"),
  API_PUBLIC_KEY: z.string().min(1, "API_PUBLIC_KEY is required"),
  ORGANIZATION_ID: z.string().min(1, "ORGANIZATION_ID is required"),
  EOA_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "EOA_ADDRESS must be a valid Ethereum address"),
  PAYMASTER_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "PAYMASTER_ADDRESS must be a valid Ethereum address"),
  BASE_RPC_URL: z.string().url("BASE_RPC_URL must be a valid URL"),
});

const env = envSchema.parse(process.env);

// ============================================================================
// Contract Addresses (Base Mainnet)
// ============================================================================

const BASE_CHAIN_ID = 8453;
const EXPLORER_URL = "https://basescan.org";

const USDC_ADDRESS: Hex = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_ADDRESS: Hex = "0x4200000000000000000000000000000000000006";
const PERMIT2_ADDRESS: Hex = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const UNIVERSAL_ROUTER_ADDRESS: Hex = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";

// Token definitions for amount parsing
const USDC_TOKEN = new Token(BASE_CHAIN_ID, USDC_ADDRESS, 6, "USDC", "USD Coin");

// ============================================================================
// Uniswap Encoding Helpers
// ============================================================================

// Universal Router command for V3 exact input swap
const V3_SWAP_EXACT_IN = 0x00;

// Function selectors
const UNIVERSAL_ROUTER_EXECUTE_SELECTOR: Hex = "0x3593564c";
const PERMIT2_APPROVE_SELECTOR: Hex = "0x87517c45";

/**
 * Encodes the swap path for Uniswap V3 (tokenIn -> fee -> tokenOut)
 */
function encodeV3SwapPath(tokenIn: Hex, fee: FeeAmount, tokenOut: Hex): Hex {
  return encodePacked(["address", "uint24", "address"], [tokenIn, fee, tokenOut]);
}

/**
 * Encodes parameters for V3_SWAP_EXACT_IN command
 */
function encodeV3SwapExactInParams(
  recipient: Hex,
  amountIn: bigint,
  amountOutMin: bigint,
  path: Hex,
  payerIsUser: boolean,
): Hex {
  return encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "bytes" },
      { type: "bool" },
    ],
    [recipient, amountIn, amountOutMin, path, payerIsUser],
  );
}

/**
 * Builds complete calldata for Universal Router execute
 */
function buildUniversalRouterExecuteCalldata(
  commands: Hex,
  inputs: Hex[],
  deadline: bigint,
): Hex {
  const params = encodeAbiParameters(
    [{ type: "bytes" }, { type: "bytes[]" }, { type: "uint256" }],
    [commands, inputs, deadline],
  );
  return concat([UNIVERSAL_ROUTER_EXECUTE_SELECTOR, params]);
}

/**
 * Builds calldata for Permit2.approve(token, spender, amount, expiration)
 */
function buildPermit2ApproveCalldata(
  token: Hex,
  spender: Hex,
  amount: bigint,
  expiration: number,
): Hex {
  const params = encodeAbiParameters(
    [{ type: "address" }, { type: "address" }, { type: "uint160" }, { type: "uint48" }],
    [token, spender, amount, expiration],
  );
  return concat([PERMIT2_APPROVE_SELECTOR, params]);
}

// ============================================================================
// Main Execution
// ============================================================================

async function main(): Promise<void> {
  print("🔄 Turnkey Gas Station: USDC → WETH Swap", "");
  print("Network", "Base Mainnet");
  print("Swap Amount", `${SWAP_AMOUNT_USDC} USDC`);
  print("User Wallet", env.EOA_ADDRESS);
  print("Paymaster", env.PAYMASTER_ADDRESS);
  print("", "");

  // Initialize Turnkey SDK
  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: env.BASE_URL,
    apiPrivateKey: env.API_PRIVATE_KEY,
    apiPublicKey: env.API_PUBLIC_KEY,
    defaultOrganizationId: env.ORGANIZATION_ID,
  });

  // Create wallet clients
  const [userAccount, paymasterAccount] = await Promise.all([
    createAccount({
      client: turnkeyClient.apiClient(),
      organizationId: env.ORGANIZATION_ID,
      signWith: env.EOA_ADDRESS as Hex,
    }),
    createAccount({
      client: turnkeyClient.apiClient(),
      organizationId: env.ORGANIZATION_ID,
      signWith: env.PAYMASTER_ADDRESS as Hex,
    }),
  ]);

  const preset = CHAIN_PRESETS.BASE_MAINNET;
  const rpcUrl = env.BASE_RPC_URL;

  const userWalletClient = createWalletClient({
    account: userAccount,
    chain: preset.chain,
    transport: http(rpcUrl),
  });

  const paymasterWalletClient = createWalletClient({
    account: paymasterAccount,
    chain: preset.chain,
    transport: http(rpcUrl),
  });

  // Initialize Gas Station clients
  const userClient = new GasStationClient({ walletClient: userWalletClient });
  const paymasterClient = new GasStationClient({ walletClient: paymasterWalletClient });

  // ──────────────────────────────────────────────────────────────────────────
  // Step 1: EIP-7702 Authorization (if needed)
  // ──────────────────────────────────────────────────────────────────────────

  print("Step 1: EIP-7702 Authorization", "");

  const isAuthorized = await userClient.isAuthorized();

  if (!isAuthorized) {
    print("Status", "EOA not authorized, signing authorization...");

    const authorization = await userClient.signAuthorization();
    const authResult = await paymasterClient.submitAuthorizations([authorization]);

    print("✅ Authorized", `${EXPLORER_URL}/tx/${authResult.txHash}`);
    await delay(2000);
  } else {
    print("✅ Already authorized", "Skipping");
  }

  print("", "");

  // ──────────────────────────────────────────────────────────────────────────
  // Step 2: Combined Approval (approveThenExecute)
  // ──────────────────────────────────────────────────────────────────────────

  print("Step 2: Combined Approval", "");
  print("Action", "ERC20 approve USDC→Permit2 + Permit2 approve for Universal Router");

  const swapAmount = parseUnits(SWAP_AMOUNT_USDC, USDC_TOKEN.decimals);
  const approveNonce = await userClient.getNonce();

  // Permit2 allowance: 1000x swap amount, expires in 30 days
  const permit2AllowanceAmount = swapAmount * 1000n;
  const permit2Expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

  // Build Permit2.approve calldata (the "execute" part of approveThenExecute)
  const permit2ApproveCalldata = buildPermit2ApproveCalldata(
    USDC_ADDRESS,
    UNIVERSAL_ROUTER_ADDRESS,
    permit2AllowanceAmount,
    permit2Expiration,
  );

  // Max ERC20 approval for USDC→Permit2 (the "approve" part of approveThenExecute)
  const maxErc20Approval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

  // Sign combined approval intent
  const approvalIntent = await userClient
    .createIntent()
    .setTarget(PERMIT2_ADDRESS)
    .withValue(0n)
    .withCallData(permit2ApproveCalldata)
    .signApprovalExecution(approveNonce, USDC_ADDRESS, PERMIT2_ADDRESS, maxErc20Approval);

  // Paymaster executes both approvals atomically
  const approvalResult = await paymasterClient.approveThenExecute(approvalIntent);

  print("✅ Approved", `${EXPLORER_URL}/tx/${approvalResult.txHash}`);
  print("Gas Used", approvalResult.gasUsed.toString());
  await delay(2000);

  print("", "");

  // ──────────────────────────────────────────────────────────────────────────
  // Step 3: Execute Swap
  // ──────────────────────────────────────────────────────────────────────────

  print("Step 3: Execute Swap", "");

  const swapNonce = await userClient.getNonce();
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 min

  // Build swap path: USDC → (0.05% fee) → WETH
  const swapPath = encodeV3SwapPath(USDC_ADDRESS, FeeAmount.LOW, WETH_ADDRESS);

  // Encode swap parameters (recipient receives WETH, user pays with USDC)
  const swapParams = encodeV3SwapExactInParams(
    env.EOA_ADDRESS as Hex,
    swapAmount,
    0n, // Accept any amount out (production should use a quote service)
    swapPath,
    true,
  );

  // Build Universal Router execute calldata
  const commands = toHex(new Uint8Array([V3_SWAP_EXACT_IN]));
  const swapCalldata = buildUniversalRouterExecuteCalldata(commands, [swapParams], deadline);

  // Sign and execute swap intent
  const swapIntent = await userClient
    .createIntent()
    .setTarget(UNIVERSAL_ROUTER_ADDRESS)
    .withValue(0n)
    .withCallData(swapCalldata)
    .sign(swapNonce);

  const swapResult = await paymasterClient.execute(swapIntent);

  print("✅ Swapped", `${EXPLORER_URL}/tx/${swapResult.txHash}`);
  print("Gas Used", swapResult.gasUsed.toString());

  print("", "");

  // ──────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────

  const totalGas = approvalResult.gasUsed + swapResult.gasUsed;

  print("═══════════════════════════════════════════", "");
  print("✅ Swap Complete!", "");
  print("Amount", `${SWAP_AMOUNT_USDC} USDC → WETH`);
  print("Total Gas", `${totalGas} (Approval: ${approvalResult.gasUsed} + Swap: ${swapResult.gasUsed})`);
  print("Transactions", "2 (combined approvals into 1 tx using approveThenExecute)");
  print("Swap TX", `${EXPLORER_URL}/tx/${swapResult.txHash}`);
  print("═══════════════════════════════════════════", "");
  print("", "");
  print("Note", "You received WETH. To get native ETH, an additional unwrap step is needed.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run with error handling
main().catch((error) => {
  console.error("\n❌ Error:", error.message || error);
  process.exit(1);
});
