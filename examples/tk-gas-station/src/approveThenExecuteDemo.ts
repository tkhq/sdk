import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseArgs } from "node:util";
import {
  parseUnits,
  createWalletClient,
  http,
  type Hex,
  encodeFunctionData,
} from "viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import {
  GasStationClient,
  CHAIN_PRESETS,
  type ChainPreset,
  ERC20_ABI,
} from "@turnkey/gas-station";
import { print } from "./utils";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Transfer amount configuration
const USDC_AMOUNT = "0.01"; // 1 penny in USDC

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

// Validate chain argument
const validChains = ["base", "mainnet"] as const;
type ValidChain = (typeof validChains)[number];

if (!validChains.includes(values.chain as ValidChain)) {
  console.error(
    `Invalid chain: ${values.chain}. Valid options: ${validChains.join(", ")}`,
  );
  process.exit(1);
}

const selectedChain = values.chain as ValidChain;

// Map chain selection to chain presets
const chainPresetMap: Record<ValidChain, ChainPreset> = {
  base: CHAIN_PRESETS.BASE_MAINNET,
  mainnet: CHAIN_PRESETS.ETHEREUM_MAINNET,
};

const preset = chainPresetMap[selectedChain];

const envSchema = z.object({
  BASE_URL: z.string().url(),
  API_PRIVATE_KEY: z.string().min(1),
  API_PUBLIC_KEY: z.string().min(1),
  ORGANIZATION_ID: z.string().min(1),
  EOA_ADDRESS: z.string().min(1),
  PAYMASTER_ADDRESS: z.string().min(1),
  ETH_RPC_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

print(
  `🌐 Using ${selectedChain.toUpperCase()} network`,
  `USDC: ${preset.tokens?.USDC}`,
);

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: env.BASE_URL,
  apiPrivateKey: env.API_PRIVATE_KEY,
  apiPublicKey: env.API_PUBLIC_KEY,
  defaultOrganizationId: env.ORGANIZATION_ID,
});

/**
 * Demonstrates approve then execute using the Gas Station pattern with EIP-7702 authorization
 * This atomically approves a token and executes a transfer in one transaction
 *
 * This example shows the separation of concerns:
 * 1. End user client signs the authorization and creates signed intents
 * 2. Paymaster client submits transactions and pays for gas
 */
const main = async () => {
  const rpcUrl = selectedChain === "base" ? env.BASE_RPC_URL : env.ETH_RPC_URL;

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

  // Explorer URL for displaying transaction links
  const explorerUrl =
    selectedChain === "base" ? "https://basescan.org" : "https://etherscan.io";

  // Step 1: Check if EOA is already authorized, authorize if needed
  const isAuthorized = await userClient.isAuthorized();

  if (!isAuthorized) {
    print("===== Starting EIP-7702 Authorization =====", "");
    print("EOA not yet authorized", "Starting authorization...");

    // Step 1: User signs the authorization
    print("User signing authorization...", "");
    const authorization = await userClient.signAuthorization();

    // Step 2: Paymaster submits the authorization transaction
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

    // This delay helps ensure proper sequencing of on-chain state after authorization.
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } else {
    print("✓ EOA already authorized", "Skipping authorization");
  }

  // Step 2: Execute USDC approve then transfer using approveThenExecute
  print("===== Starting Approve Then Execute =====", "");

  const transferAmount = parseUnits(USDC_AMOUNT, 6); // 6 decimals for USDC

  // Get USDC address from preset
  const usdcAddress = preset.tokens?.USDC;
  if (!usdcAddress) {
    throw new Error(`USDC address not configured for ${selectedChain}`);
  }

  // For this example, we'll approve USDC to the USDC contract itself and then transfer
  // In a real scenario, you might approve to a DEX router or other contract
  const spenderAddress = usdcAddress; // Approve to self for this demo
  const approveAmount = transferAmount; // Approve exactly the amount we need

  // Encode the transfer call that will execute after approval
  const transferCallData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [env.PAYMASTER_ADDRESS as Hex, transferAmount],
  });

  print(
    `Approving and executing USDC transfer`,
    `Approving ${approveAmount} units to ${spenderAddress}, then transferring ${transferAmount} units (${USDC_AMOUNT} USDC) to ${env.PAYMASTER_ADDRESS}`,
  );

  // Step 1: User gets their current nonce
  const nonce = await userClient.getNonce();
  print(`Current nonce: ${nonce}`, "");

  // Step 2: User creates the intent builder and signs the approval execution
  const intentBuilder = userClient
    .createIntent()
    .setTarget(usdcAddress) // The target contract for the execution
    .withValue(0n) // No ETH value for ERC20 transfer
    .withCallData(transferCallData); // The call data to execute after approval

  // Sign the approval execution intent
  const intent = await intentBuilder.signApprovalExecution(
    nonce,
    usdcAddress,
    spenderAddress, // Address to approve (in real scenario might be a DEX)
    approveAmount, // Amount to approve
  );

  print("✓ Approval execution intent signed by user", "");

  // Step 3: Paymaster executes the signed intent using approveThenExecute
  print("Executing approve then execute via gas station...", "");
  const result = await paymasterClient.approveThenExecute(intent);
  print("Approve then execute transaction sent", result.txHash);
  print("Waiting for confirmation...", "");
  print("✅ Execution SUCCEEDED", "");
  print("Confirmed", `Block: ${result.blockNumber}, Gas: ${result.gasUsed}`);

  print("===== Approve Then Execute Complete =====", "");
  print(
    `✅ Successfully approved and transferred ${USDC_AMOUNT} USDC from EOA to paymaster`,
    `TX: ${explorerUrl}/tx/${result.txHash}`,
  );
  print("Gas usage", `${result.gasUsed} gas units`);
};

main();
