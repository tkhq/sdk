import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseArgs } from "node:util";
import { parseEther, createWalletClient, http } from "viem";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import {
  GasStationClient,
  buildETHTransfer,
  CHAIN_PRESETS,
  type ChainPreset,
} from "@turnkey/gas-station";
import { print } from "./utils";

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
  `ETH transfers on ${preset.chain.name}`,
);

const turnkeyClient = new TurnkeyServerSDK({
  apiBaseUrl: env.BASE_URL,
  apiPrivateKey: env.API_PRIVATE_KEY,
  apiPublicKey: env.API_PUBLIC_KEY,
  defaultOrganizationId: env.ORGANIZATION_ID,
});

/**
 * Demonstrates ETH transfer using the Gas Station pattern with EIP-7702 authorization
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
    signWith: env.PAYMASTER_ADDRESS as `0x${string}`,
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

  // Step 1: Check if EOA is already delegated, authorize if needed
  const isDelegated = await userClient.isDelegated();

  if (!isDelegated) {
    print("===== Starting EIP-7702 Authorization =====", "");
    print("EOA not yet delegated", "Starting authorization...");
    print("User signing authorization...", "");
    const authResult = await userClient.authorize(paymasterClient);
    print("Authorization transaction sent", authResult.txHash);
    print("Waiting for confirmation...", "");
    print("✅ Authorization SUCCEEDED", "");
    print("Verifying delegation on-chain...", "");
    print("✓ Delegation verified on-chain", "");
    print(
      "✅ Authorization complete",
      `${explorerUrl}/tx/${authResult.txHash}`,
    );
  } else {
    print("✓ EOA already delegated", "Skipping authorization");
  }

  // Step 2: Execute ETH transfer using the generic execute API with helpers
  print("===== Starting ETH Transfer =====", "");

  const transferAmount = parseEther("0.0001"); // 0.0001 ETH

  // Build the execution parameters using the helper
  const executionParams = buildETHTransfer(
    env.PAYMASTER_ADDRESS as `0x${string}`, // transfer eth to paymaster from EOA
    transferAmount,
  );

  print(
    `Executing ETH transfer`,
    `${transferAmount} wei (0.0001 ETH) to ${env.PAYMASTER_ADDRESS}`,
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
  print("Executing intent via gas station...", "");
  const result = await paymasterClient.execute(intent);
  print("Execution transaction sent", result.txHash);
  print("Waiting for confirmation...", "");
  print("✅ Execution SUCCEEDED", "");
  print("Confirmed", `Block: ${result.blockNumber}, Gas: ${result.gasUsed}`);

  print("===== ETH Transfer Complete =====", "");
  print(
    "✅ Successfully transferred 0.0001 ETH from EOA to paymaster",
    `TX: ${explorerUrl}/tx/${result.txHash}`,
  );
  print("Gas usage", `${result.gasUsed} gas units`);
};

main();
