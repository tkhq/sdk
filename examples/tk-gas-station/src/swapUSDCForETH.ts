import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseArgs } from "node:util";
import {
  parseUnits,
  createWalletClient,
  createPublicClient,
  http,
  encodeAbiParameters,
  encodePacked,
  type Hex,
  concat,
  toHex,
} from "viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import { GasStationClient, CHAIN_PRESETS, buildTokenApproval } from "@turnkey/gas-station";
import { print } from "./utils";

// Uniswap SDK imports for token definitions and types
import { Token, Percent } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Swap configuration
const USDC_AMOUNT = "0.10"; // 10 cents USDC to swap
const MIN_ETH_OUT = 0n; // Accept any amount for demo (production should use a quote)
const SLIPPAGE_PERCENT = new Percent(50, 10000); // 0.5% slippage (for reference)

// Chain ID for Base mainnet
const BASE_CHAIN_ID = 8453;

// Contract addresses on Base mainnet
const UNIVERSAL_ROUTER_ADDRESS: Hex =
  "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD"; // Universal Router on Base
const PERMIT2_ADDRESS: Hex =
  "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Permit2 (same on all chains)
const WETH_ADDRESS: Hex = "0x4200000000000000000000000000000000000006";
const USDC_ADDRESS: Hex = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Universal Router command codes
const V3_SWAP_EXACT_IN = 0x00;

// Universal Router ABI for execute function
const UNIVERSAL_ROUTER_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "commands", type: "bytes" },
      { name: "inputs", type: "bytes[]" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// Permit2 ABI for approve and allowance functions
const PERMIT2_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
    ],
    outputs: [],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "amount", type: "uint160" },
      { name: "expiration", type: "uint48" },
      { name: "nonce", type: "uint48" },
    ],
  },
] as const;

// ERC20 ABI for allowance check
const ERC20_ALLOWANCE_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Parse command line arguments
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    chain: {
      type: "string",
      short: "c",
      default: "base",
    },
  },
});

// This example only supports Base mainnet
if (values.chain !== "base") {
  console.error("This swap example only supports Base mainnet.");
  process.exit(1);
}

const preset = CHAIN_PRESETS.BASE_MAINNET;

const envSchema = z.object({
  BASE_URL: z.string().url(),
  API_PRIVATE_KEY: z.string().min(1),
  API_PUBLIC_KEY: z.string().min(1),
  ORGANIZATION_ID: z.string().min(1),
  EOA_ADDRESS: z.string().min(1),
  PAYMASTER_ADDRESS: z.string().min(1),
  BASE_RPC_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

print(
  `🌐 Using BASE network`,
  `Swapping USDC for ETH via Uniswap Universal Router`,
);

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: env.BASE_URL,
  apiPrivateKey: env.API_PRIVATE_KEY,
  apiPublicKey: env.API_PUBLIC_KEY,
  defaultOrganizationId: env.ORGANIZATION_ID,
});

// Define tokens using Uniswap SDK for type safety
const USDC_TOKEN = new Token(BASE_CHAIN_ID, USDC_ADDRESS, 6, "USDC", "USD Coin");
const WETH_TOKEN = new Token(BASE_CHAIN_ID, WETH_ADDRESS, 18, "WETH", "Wrapped Ether");

/**
 * Encodes the path for a V3 swap (tokenIn -> fee -> tokenOut).
 * The path format is: [tokenIn, fee, tokenOut] packed together.
 */
function encodeV3Path(tokenIn: Hex, fee: FeeAmount, tokenOut: Hex): Hex {
  return encodePacked(
    ["address", "uint24", "address"],
    [tokenIn, fee, tokenOut],
  );
}

/**
 * Encodes the input for V3_SWAP_EXACT_IN command.
 * Format: (address recipient, uint256 amountIn, uint256 amountOutMin, bytes path, bool payerIsUser)
 */
function encodeV3SwapExactIn(
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
 * Demonstrates USDC to ETH swap using the Gas Station pattern with EIP-7702 authorization.
 * Uses Uniswap Universal Router on Base mainnet with separate approve and execute steps.
 *
 * This is ideal for gasless users who hold USDC but no ETH:
 * 1. EOA signs intent to approve USDC to Permit2 → Paymaster executes
 * 2. EOA signs intent to approve Universal Router on Permit2 → Paymaster executes
 * 3. EOA signs intent to execute swap → Paymaster executes
 * 4. EOA receives WETH in exchange for USDC
 */
const main = async () => {
  const rpcUrl = env.BASE_RPC_URL;

  // Create viem wallet clients with Turnkey accounts
  const userAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: env.ORGANIZATION_ID,
    signWith: env.EOA_ADDRESS as Hex,
  });

  const paymasterAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: env.ORGANIZATION_ID,
    signWith: env.PAYMASTER_ADDRESS as Hex,
  });

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

  // Create Gas Station clients with the viem wallet clients
  const userClient = new GasStationClient({
    walletClient: userWalletClient,
  });

  const paymasterClient = new GasStationClient({
    walletClient: paymasterWalletClient,
  });

  // Create public client for reading on-chain data
  const publicClient = createPublicClient({
    chain: preset.chain,
    transport: http(rpcUrl),
  });

  const explorerUrl = "https://basescan.org";

  // Step 1: Check if EOA is already authorized, authorize if needed
  const isAuthorized = await userClient.isAuthorized();

  if (!isAuthorized) {
    print("===== Starting EIP-7702 Authorization =====", "");
    print("EOA not yet authorized", "Starting authorization...");

    print("User signing authorization...", "");
    const authorization = await userClient.signAuthorization();

    const authResult = await paymasterClient.submitAuthorizations([
      authorization,
    ]);

    print("Authorization transaction sent", authResult.txHash);
    print("Waiting for confirmation...", "");
    print("✅ Authorization SUCCEEDED", "");
    print(
      "✅ Authorization complete",
      `${explorerUrl}/tx/${authResult.txHash}`,
    );

    // Delay to ensure proper sequencing of on-chain state after authorization
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } else {
    print("✓ EOA already authorized", "Skipping authorization");
  }

  // Step 2: Execute USDC to ETH swap via Uniswap Universal Router
  print("===== Starting USDC → ETH Swap =====", "");

  const swapAmount = parseUnits(USDC_AMOUNT, USDC_TOKEN.decimals);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minutes

  // Encode the V3 swap path: USDC -> 0.05% fee -> WETH
  const swapPath = encodeV3Path(USDC_ADDRESS, FeeAmount.LOW, WETH_ADDRESS);

  // Encode the swap input for V3_SWAP_EXACT_IN
  // recipient = EOA address, payerIsUser = true (USDC comes from msg.sender)
  const swapInput = encodeV3SwapExactIn(
    env.EOA_ADDRESS as Hex,
    swapAmount,
    MIN_ETH_OUT,
    swapPath,
    true, // payerIsUser - the EOA pays with their USDC
  );

  // Build the Universal Router execute calldata
  const commands = toHex(new Uint8Array([V3_SWAP_EXACT_IN])); // Single command: V3_SWAP_EXACT_IN
  const inputs = [swapInput]; // Corresponding input for the command

  // Encode the execute function call
  const swapCallData = encodeAbiParameters(
    [
      { type: "bytes" },
      { type: "bytes[]" },
      { type: "uint256" },
    ],
    [commands, inputs, deadline],
  );

  // Prepend the function selector for execute(bytes,bytes[],uint256)
  const executeSelector = "0x3593564c" as Hex; // keccak256("execute(bytes,bytes[],uint256)")[:4]
  const fullSwapCallData = concat([executeSelector, swapCallData]);

  print(
    `Swapping ${USDC_AMOUNT} USDC for ETH`,
    `Recipient: ${env.EOA_ADDRESS}`,
  );
  print(
    "Swap parameters",
    `Amount: ${swapAmount} (${USDC_AMOUNT} USDC), Fee tier: ${FeeAmount.LOW / 10000}%, Deadline: ${deadline}`,
  );

  // ===== Step 2a: Approve USDC to Permit2 (if needed) =====
  print("--- Step 2a: Check/Approve USDC to Permit2 ---", "");

  // Check existing ERC20 allowance to Permit2
  const erc20Allowance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ALLOWANCE_ABI,
    functionName: "allowance",
    args: [env.EOA_ADDRESS as Hex, PERMIT2_ADDRESS],
  });

  let erc20ApproveResult: { gasUsed: bigint } | null = null;

  if (erc20Allowance >= swapAmount) {
    print("✓ ERC20 allowance to Permit2 already sufficient", `${erc20Allowance} >= ${swapAmount}`);
  } else {
    print(`ERC20 allowance insufficient (${erc20Allowance} < ${swapAmount})`, "Approving...");

    const approveNonce = await userClient.getNonce();
    print(`Current nonce: ${approveNonce}`, "");

    // Build the ERC20 approval to Permit2
    const erc20ApprovalParams = buildTokenApproval(
      USDC_ADDRESS,
      PERMIT2_ADDRESS,
      BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"), // Max approval
    );

    // User signs the ERC20 approval intent
    const erc20ApproveIntent = await userClient
      .createIntent()
      .setTarget(erc20ApprovalParams.outputContract)
      .withValue(erc20ApprovalParams.value ?? 0n)
      .withCallData(erc20ApprovalParams.callData)
      .sign(approveNonce);

    print("✓ ERC20 approval intent signed by user", "");

    // Paymaster executes the ERC20 approval
    print("Executing USDC approval to Permit2...", "");
    erc20ApproveResult = await paymasterClient.execute(erc20ApproveIntent);
    print("ERC20 Approval transaction sent", (erc20ApproveResult as any).txHash);
    print("✅ ERC20 Approval SUCCEEDED", "");
    print(
      "Confirmed",
      `Block: ${(erc20ApproveResult as any).blockNumber}, Gas: ${erc20ApproveResult.gasUsed}`,
    );
    print("", `${explorerUrl}/tx/${(erc20ApproveResult as any).txHash}`);

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // ===== Step 2b: Approve Universal Router on Permit2 (if needed) =====
  print("--- Step 2b: Check/Approve Universal Router on Permit2 ---", "");

  // Check existing Permit2 allowance for Universal Router
  const [permit2Amount, permit2Expiry] = await publicClient.readContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: "allowance",
    args: [env.EOA_ADDRESS as Hex, USDC_ADDRESS, UNIVERSAL_ROUTER_ADDRESS],
  });

  const currentTime = Math.floor(Date.now() / 1000);
  let permit2ApproveResult: { gasUsed: bigint } | null = null;

  if (permit2Amount >= swapAmount && permit2Expiry > currentTime) {
    print(
      "✓ Permit2 allowance for Universal Router already sufficient",
      `Amount: ${permit2Amount} >= ${swapAmount}, Expires: ${new Date(Number(permit2Expiry) * 1000).toISOString()}`,
    );
  } else {
    const reason = permit2Amount < swapAmount
      ? `Amount insufficient (${permit2Amount} < ${swapAmount})`
      : `Expired (${permit2Expiry} <= ${currentTime})`;
    print(`Permit2 allowance needs update: ${reason}`, "Approving...");

    const permit2ApproveNonce = await userClient.getNonce();
    print(`Current nonce: ${permit2ApproveNonce}`, "");

    // Permit2 expiration: 30 days from now
    const permit2Expiration = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;

    // Build the Permit2 approve call with a larger amount for future swaps
    const approveAmount = swapAmount * 1000n; // Approve 1000x the swap amount for future use
    const permit2ApproveCallData = encodeAbiParameters(
      [
        { type: "address" },
        { type: "address" },
        { type: "uint160" },
        { type: "uint48" },
      ],
      [
        USDC_ADDRESS,
        UNIVERSAL_ROUTER_ADDRESS,
        approveAmount,
        permit2Expiration,
      ],
    );

    // Prepend the function selector for approve(address,address,uint160,uint48)
    const permit2ApproveSelector = "0x87517c45" as Hex; // keccak256("approve(address,address,uint160,uint48)")[:4]
    const fullPermit2ApproveCallData = concat([permit2ApproveSelector, permit2ApproveCallData]);

    // User signs the Permit2 approval intent
    const permit2ApproveIntent = await userClient
      .createIntent()
      .setTarget(PERMIT2_ADDRESS)
      .withValue(0n)
      .withCallData(fullPermit2ApproveCallData)
      .sign(permit2ApproveNonce);

    print("✓ Permit2 approval intent signed by user", "");

    // Paymaster executes the Permit2 approval
    print("Executing Permit2 approval for Universal Router...", "");
    permit2ApproveResult = await paymasterClient.execute(permit2ApproveIntent);
    print("Permit2 Approval transaction sent", (permit2ApproveResult as any).txHash);
    print("✅ Permit2 Approval SUCCEEDED", "");
    print(
      "Confirmed",
      `Block: ${(permit2ApproveResult as any).blockNumber}, Gas: ${permit2ApproveResult.gasUsed}`,
    );
    print("", `${explorerUrl}/tx/${(permit2ApproveResult as any).txHash}`);

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // ===== Step 2c: Execute the Swap =====
  print("--- Step 2c: Execute Swap ---", "");

  const swapNonce = await userClient.getNonce();
  print(`Current nonce: ${swapNonce}`, "");

  // User signs the swap intent
  const swapIntent = await userClient
    .createIntent()
    .setTarget(UNIVERSAL_ROUTER_ADDRESS)
    .withValue(0n) // No ETH value needed for USDC → WETH swap
    .withCallData(fullSwapCallData)
    .sign(swapNonce);

  print("✓ Swap intent signed by user", "");

  // Paymaster executes the swap
  print("Executing swap via gas station...", "");
  const swapResult = await paymasterClient.execute(swapIntent);
  print("Swap transaction sent", swapResult.txHash);
  print("✅ Swap SUCCEEDED", "");
  print(
    "Confirmed",
    `Block: ${swapResult.blockNumber}, Gas: ${swapResult.gasUsed}`,
  );

  print("===== USDC → ETH Swap Complete =====", "");
  print(
    `✅ Successfully swapped ${USDC_AMOUNT} USDC for WETH`,
    `TX: ${explorerUrl}/tx/${swapResult.txHash}`,
  );
  const erc20Gas = erc20ApproveResult?.gasUsed ?? 0n;
  const permit2Gas = permit2ApproveResult?.gasUsed ?? 0n;
  const totalGas = erc20Gas + permit2Gas + swapResult.gasUsed;

  print(
    "Gas usage breakdown",
    `ERC20 Approve: ${erc20Gas} + Permit2 Approve: ${permit2Gas} + Swap: ${swapResult.gasUsed} = ${totalGas} gas units`,
  );

  if (erc20Gas === 0n && permit2Gas === 0n) {
    print("💡 Tip", "Approvals were skipped because they already exist. Only the swap was executed!");
  }
  print(
    "Note",
    "You received WETH. To get native ETH, an additional unwrap step would be needed.",
  );
};

main();
