import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { sweepUSDC } from "./sweepUSDC";
import { getOrCreateTreasury } from "./treasury";
import {
  USDC_TOKEN_ADDRESSES,
  formatAddress,
} from "./utils";

async function main() {
  console.log("Payflow Demo - Sweep Existing Merchant Wallet\n");

  // Validate environment variables
  const requiredEnvVars = ["API_PUBLIC_KEY", "API_PRIVATE_KEY", "ORGANIZATION_ID"];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Get merchant wallet details from command line or env
  const merchantAddress = process.argv[2] || process.env.MERCHANT_WALLET_ADDRESS;
  const merchantSubOrgId = process.argv[3] || process.env.MERCHANT_SUB_ORG_ID;
  const merchantWalletId = process.argv[4] || process.env.MERCHANT_WALLET_ID;

  if (!merchantAddress || !merchantSubOrgId) {
    console.error("Missing merchant wallet information");
    console.error("\nUsage:");
    console.error("  npx tsx src/sweep-existing.ts <merchantAddress> <subOrgId> [walletId]");
    console.error("\nOr set in .env.local:");
    console.error("  MERCHANT_WALLET_ADDRESS=0x...");
    console.error("  MERCHANT_SUB_ORG_ID=...");
    console.error("  MERCHANT_WALLET_ID=... (optional)");
    process.exit(1);
  }

  const network = process.env.NETWORK || "sepolia";
  const usdcTokenAddress =
    process.env.USDC_TOKEN_ADDRESS || USDC_TOKEN_ADDRESSES[network];

  if (!usdcTokenAddress) {
    console.error(`USDC token address not found for network: ${network}`);
    process.exit(1);
  }

  console.log(`Network: ${network}`);
  console.log(`USDC Token: ${formatAddress(usdcTokenAddress)}`);
  console.log(`Merchant Wallet: ${formatAddress(merchantAddress)}`);
  console.log(`Sub-Organization: ${merchantSubOrgId}\n`);

  try {
    // Get or create treasury wallet
    console.log("=".repeat(60));
    console.log("STEP 1: Setting up Treasury Wallet");
    console.log("=".repeat(60));
    const treasury = await getOrCreateTreasury();
    console.log(`Treasury Address: ${treasury.address}\n`);

    // Sweep USDC
    console.log("=".repeat(60));
    console.log("STEP 2: Sweeping USDC to Treasury");
    console.log("=".repeat(60));
    const sweepResult = await sweepUSDC(
      merchantAddress,
      merchantSubOrgId,
      merchantWalletId || merchantAddress,
      treasury.address,
      usdcTokenAddress,
      network,
    );

    if (sweepResult.success) {
      console.log(`Sweep Success!`);
      console.log(`   Amount: ${sweepResult.amount} USDC`);
      if (sweepResult.transactionHash) {
        const explorerBase =
          network === "sepolia"
            ? "https://sepolia.etherscan.io"
            : network === "goerli"
              ? "https://goerli.etherscan.io"
              : "https://etherscan.io";
        console.log(
          `   Transaction: ${explorerBase}/tx/${sweepResult.transactionHash}`,
        );
      }
    } else {
      console.log(`Sweep failed: ${sweepResult.error}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("SWEEP SUMMARY");
    console.log("=".repeat(60));
    console.log(`Merchant Wallet:    ${formatAddress(merchantAddress)}`);
    console.log(`Treasury Wallet:    ${formatAddress(treasury.address)}`);
    if (sweepResult.success) {
      console.log(`Sweep Status:       ${sweepResult.amount} USDC transferred`);
      if (sweepResult.transactionHash) {
        console.log(`Transaction Hash:   ${sweepResult.transactionHash}`);
      }
    } else {
      console.log(`Sweep Status:       ${sweepResult.error || "Failed"}`);
    }
    console.log("=".repeat(60));
    console.log("\nSweep completed!\n");
  } catch (error: any) {
    console.error("\nError during sweep:");
    console.error(error.message || error);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

