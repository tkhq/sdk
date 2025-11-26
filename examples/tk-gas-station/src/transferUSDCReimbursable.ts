import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseArgs } from "node:util";
import { parseUnits, createWalletClient, http, type Hex } from "viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import {
  GasStationClient,
  buildTokenTransfer,
  CHAIN_PRESETS,
  type ChainPreset,
  type ReimbursableExecutionIntent,
} from "@turnkey/gas-station";
import { print } from "./utils";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

// Transfer amount configuration
const USDC_AMOUNT = "0.01"; // 1 penny in USDC
const INITIAL_DEPOSIT_USDC = "1"; // 1 USDC initial deposit for gas (excess refunded)
const TRANSACTION_GAS_LIMIT = 200000n; // Gas limit in wei for the inner transaction

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
 * Demonstrates USDC transfer using the Reimbursable Gas Station pattern.
 * In this flow, the EOA pays for gas in USDC instead of the paymaster paying.
 *
 * Key differences from regular gas station:
 * 1. EOA signs TWO signatures:
 *    - Execution signature (same as regular flow) - authorizes the transaction
 *    - Session signature (new!) - authorizes USDC transfers for gas payment
 * 2. Contract pulls USDC from EOA, executes transaction, and refunds excess
 * 3. Paymaster submits the transaction but EOA pays for gas in USDC
 * 4. Session signature can be cached and reused across multiple transactions
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

  // Step 2: Sign session signature for USDC transfer authorization
  print("===== Creating Session Signature =====", "");

  const usdcAddress = preset.tokens?.USDC;
  if (!usdcAddress) {
    throw new Error(`USDC address not configured for ${selectedChain}`);
  }

  const nonce = await userClient.getNonce();
  print(`Current nonce: ${nonce}`, "");

  // Get the reimbursable contract address from the client
  const reimbursableContract = (userClient as any).reimbursableContract as Hex;

  const initialDepositUSDC = parseUnits(INITIAL_DEPOSIT_USDC, 6); // 6 decimals for USDC

  // Sign session signature to authorize USDC transfer for gas payment
  // Note: The session signature does NOT commit to a specific amount
  // It's a general authorization for the reimbursable contract to interact with USDC
  const sessionSignature = await userClient
    .createIntent()
    .signSessionForUSDCTransfer(
      nonce,
      usdcAddress,
      reimbursableContract,
    );

  print(
    "✓ Session signature created",
    `Authorizes USDC transfers for gas payment`,
  );

  // Step 3: Create execution parameters for USDC transfer
  print("===== Starting USDC Transfer with Reimbursement =====", "");

  const transferAmount = parseUnits(USDC_AMOUNT, 6); // 6 decimals for USDC

  // Build the execution parameters using the helper
  const executionParams = buildTokenTransfer(
    usdcAddress,
    env.PAYMASTER_ADDRESS as Hex,
    transferAmount,
  );

  print(
    `Executing USDC transfer`,
    `${transferAmount} units (${USDC_AMOUNT} USDC) to ${env.PAYMASTER_ADDRESS}`,
  );

  // Step 3b: User creates and signs the execution intent
  const executionIntent = await userClient
    .createIntent()
    .setTarget(executionParams.outputContract)
    .withValue(executionParams.value ?? 0n)
    .withCallData(executionParams.callData)
    .sign(nonce);

  print("✓ Execution intent signed by user", "");

  // Create the reimbursable execution intent (includes both signatures!)
  const reimbursableIntent: ReimbursableExecutionIntent = {
    ...executionIntent,
    initialDepositUSDC,
    transactionGasLimitWei: TRANSACTION_GAS_LIMIT,
    sessionSignature,
  };

  print("✓ Reimbursable intent created", "Includes execution + session signatures");

  // Step 4: Paymaster executes with reimbursement (EOA pays for gas in USDC)
  print("Executing intent via reimbursable gas station...", "");
  const result = await paymasterClient.executeWithReimbursement(
    reimbursableIntent,
  );

  print("Execution transaction sent", result.txHash);
  print("Waiting for confirmation...", "");
  print("✅ Execution SUCCEEDED", "");
  print("Confirmed", `Block: ${result.blockNumber}, Gas: ${result.gasUsed}`);

  print("===== USDC Transfer Complete =====", "");
  print(
    "✅ Successfully transferred 0.01 USDC from EOA to paymaster",
    `TX: ${explorerUrl}/tx/${result.txHash}`,
  );
  print("Gas payment", `EOA deposited ${INITIAL_DEPOSIT_USDC} USDC for gas (excess refunded)`);
  print("Gas usage", `${result.gasUsed} gas units`);

  // Optional: Demonstrate cached session signature usage
  print("\n===== Demonstrating Cached Session Signature =====", "");
  print(
    "Note",
    "On subsequent calls, you can pass '0x' as sessionSignature to use cached signature",
  );
};

main();

