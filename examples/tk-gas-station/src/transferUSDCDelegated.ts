import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseArgs } from "node:util";
import { parseUnits, createWalletClient, http } from "viem";
import { base, mainnet } from "viem/chains";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import {
  GasStationClient,
  buildTokenTransfer,
  print,
} from "@turnkey/gas-station";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

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

// Chain and USDC address configuration
const chainConfig = {
  base: {
    chain: base,
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorerUrl: "https://basescan.org",
  },
  mainnet: {
    chain: mainnet,
    usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    explorerUrl: "https://etherscan.io",
  },
} as const;

const config = chainConfig[selectedChain];

const envSchema = z.object({
  BASE_URL: z.string().url(),
  API_PRIVATE_KEY: z.string().min(1),
  API_PUBLIC_KEY: z.string().min(1),
  ORGANIZATION_ID: z.string().min(1),
  EOA_ADDRESS: z.string().min(1),
  PAYMASTER: z.string().min(1),
  ETH_RPC_URL: z.string().url(),
  BASE_RPC_URL: z.string().url(),
});

const env = envSchema.parse(process.env);

print(
  `🌐 Using ${selectedChain.toUpperCase()} network`,
  `USDC: ${config.usdcAddress}`,
);

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: env.BASE_URL,
  apiPrivateKey: env.API_PRIVATE_KEY,
  apiPublicKey: env.API_PUBLIC_KEY,
  defaultOrganizationId: env.ORGANIZATION_ID,
});

/**
 * Demonstrates USDC transfer using the Gas Station pattern with EIP-7702 authorization
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
    signWith: env.EOA_ADDRESS as `0x${string}`,
  });

  const paymasterAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId: env.ORGANIZATION_ID,
    signWith: env.PAYMASTER as `0x${string}`,
  });

  const userWalletClient = createWalletClient({
    account: userAccount,
    chain: config.chain,
    transport: http(rpcUrl),
  });

  const paymasterWalletClient = createWalletClient({
    account: paymasterAccount,
    chain: config.chain,
    transport: http(rpcUrl),
  });

  // Create Gas Station clients with the viem wallet clients
  const userClient = new GasStationClient({
    walletClient: userWalletClient,
    explorerUrl: config.explorerUrl,
  });

  const paymasterClient = new GasStationClient({
    walletClient: paymasterWalletClient,
    explorerUrl: config.explorerUrl,
  });

  // Step 1: Check if EOA is already delegated, authorize if needed
  const isDelegated = await userClient.isDelegated();

  if (!isDelegated) {
    print("EOA not yet delegated", "Starting authorization...");
    await userClient.authorize(paymasterClient);
  } else {
    print("✓ EOA already delegated", "Skipping authorization");
  }

  // Step 2: Execute USDC transfer using the generic execute API with helpers
  print("===== Starting USDC Transfer =====", "");

  const transferAmount = parseUnits("0.01", 6); // 1 penny in USDC (6 decimals)

  // Build the execution parameters using the helper
  const executionParams = buildTokenTransfer(
    config.usdcAddress as `0x${string}`,
    env.PAYMASTER as `0x${string}`,
    transferAmount,
  );

  print(
    `Executing USDC transfer`,
    `${transferAmount} units (0.01 USDC) to ${env.PAYMASTER}`,
  );

  // Step 1: User gets their current nonce
  const nonce = await userClient.getNonce();
  print(`Current nonce: ${nonce}`, "");

  // Step 2: User creates and signs the intent
  const intent = await userClient
    .createIntent()
    .setTarget(executionParams.outputContract)
    .withValue(executionParams.value ?? 0n)
    .withCallData(executionParams.callData)
    .sign(nonce);

  print("✓ Intent signed by user", "");

  // Step 3: Paymaster executes the signed intent
  const result = await paymasterClient.execute(intent);

  print("===== USDC Transfer Complete =====", "");
  print(
    "✅ Successfully transferred 1 penny USDC from EOA to paymaster",
    `TX: ${config.explorerUrl}/tx/${result.txHash}`,
  );
  print("Gas usage", `${result.gasUsed} gas units`);
};

main();
