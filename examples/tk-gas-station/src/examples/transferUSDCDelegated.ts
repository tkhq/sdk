import { resolve } from "path";
import * as dotenv from "dotenv";
import { z } from "zod";
import { parseArgs } from "node:util";
import { parseUnits } from "viem";
import { base, mainnet } from "viem/chains";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { GasStationClient, GasStationHelpers, print } from "../lib";

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
    `Invalid chain: ${values.chain}. Valid options: ${validChains.join(", ")}`
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
  DELEGATE_CONTRACT: z.string().min(1),
  EXECUTION_CONTRACT: z.string().min(1),
  SKIP_AUTHORIZATION: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

const env = envSchema.parse(process.env);

print(
  `🌐 Using ${selectedChain.toUpperCase()} network`,
  `USDC: ${config.usdcAddress}`
);

print(
  `🔧 Gas Station Configuration`,
  `Delegate: ${env.DELEGATE_CONTRACT}, Execution: ${env.EXECUTION_CONTRACT}`
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
 * This example shows how to use the GasStationClient to:
 * 1. Authorize an EOA to use the gas station contract (one-time setup)
 * 2. Execute gasless USDC transfers where the paymaster pays for gas
 */
const main = async () => {
  // Initialize the Gas Station client with configuration
  const gasStation = new GasStationClient({
    turnkeyClient,
    organizationId: env.ORGANIZATION_ID,
    eoaAddress: env.EOA_ADDRESS as `0x${string}`,
    paymasterAddress: env.PAYMASTER as `0x${string}`,
    delegateContract: env.DELEGATE_CONTRACT as `0x${string}`,
    executionContract: env.EXECUTION_CONTRACT as `0x${string}`,
    chain: config.chain,
    rpcUrl: selectedChain === "base" ? env.BASE_RPC_URL : env.ETH_RPC_URL,
    explorerUrl: config.explorerUrl,
  });

  // Step 1: Authorize the EOA via EIP-7702 (optional if already authorized)
  if (!env.SKIP_AUTHORIZATION) {
    await gasStation.authorize();
  } else {
    print(
      "===== Skipping EIP-7702 Authorization (SKIP_AUTHORIZATION=true) =====",
      "Assuming EOA is already authorized"
    );
  }

  // Step 2: Execute USDC transfer using the generic execute API with helpers
  print("===== Starting USDC Transfer =====", "");

  const transferAmount = parseUnits("0.01", 6); // 1 penny in USDC (6 decimals)

  // Build the execution parameters using the helper
  const executionParams = GasStationHelpers.buildTokenTransfer(
    config.usdcAddress as `0x${string}`,
    env.PAYMASTER as `0x${string}`,
    transferAmount
  );

  print(
    `Executing USDC transfer`,
    `${transferAmount} units (0.01 USDC) to ${env.PAYMASTER}`
  );

  // Execute the generic action
  const result = await gasStation.execute(executionParams);

  print("===== USDC Transfer Complete =====", "");
  print(
    "✅ Successfully transferred 1 penny USDC from EOA to paymaster",
    `TX: ${config.explorerUrl}/tx/${result.txHash}`
  );
  print("Gas usage", `${result.gasUsed} gas units`);
};

main();
