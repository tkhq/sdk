/**
 * Path 1: Direct Wallet Import - Sweep Funds
 *
 * This example demonstrates how to sweep funds from an imported wallet
 * to a safe treasury address during a disaster recovery event.
 *
 * Features:
 * - Sweep ETH to a safe address
 * - Configurable gas parameters
 * - Transaction status polling
 *
 * Usage: pnpm run path1:sweep-funds
 */

import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { createAccount } from "@turnkey/viem";
import * as viem from "viem";
import { sepolia, mainnet } from "viem/chains";

const { createWalletClient, createPublicClient, http, formatEther } = viem;

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Network configurations
const NETWORKS = {
  sepolia: {
    chain: sepolia,
    rpcUrl: process.env.ALCHEMY_API_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://ethereum-sepolia-rpc.publicnode.com",
    explorerUrl: "https://sepolia.etherscan.io",
  },
  mainnet: {
    chain: mainnet,
    rpcUrl: process.env.ALCHEMY_API_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : "https://eth.llamarpc.com",
    explorerUrl: "https://etherscan.io",
  },
};

async function main() {
  console.log("=".repeat(60));
  console.log("Path 1: Disaster Recovery - Fund Sweeping");
  console.log("=".repeat(60));
  console.log();

  // Validate environment variables
  const organizationId = process.env.ORGANIZATION_ID;
  const signWith = process.env.SIGN_WITH;
  const safeTreasury = process.env.SAFE_TREASURY_ADDRESS;

  if (!organizationId) {
    throw new Error("Missing required environment variable: ORGANIZATION_ID");
  }

  if (!signWith) {
    throw new Error(
      "Missing SIGN_WITH - set this to the imported wallet/key address"
    );
  }

  if (!safeTreasury) {
    throw new Error(
      "Missing SAFE_TREASURY_ADDRESS - set this to your safe destination address"
    );
  }

  // Select network
  const { network } = await prompts({
    type: "select",
    name: "network",
    message: "Select network:",
    choices: [
      {
        title: "Sepolia (Testnet) - Recommended for testing",
        value: "sepolia",
      },
      { title: "Mainnet - Production use only", value: "mainnet" },
    ],
  });

  if (!network) {
    console.log("Operation cancelled.");
    return;
  }

  const networkConfig = NETWORKS[network as keyof typeof NETWORKS];

  // Initialize Turnkey client
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  // Create viem clients
  const publicClient = createPublicClient({
    chain: networkConfig.chain,
    transport: http(networkConfig.rpcUrl),
  });

  // Create Turnkey account for signing
  console.log();
  console.log("Creating Turnkey signing account...");
  const turnkeyAccount = await createAccount({
    client: turnkeyClient.apiClient(),
    organizationId,
    signWith,
  });

  const walletClient = createWalletClient({
    account: turnkeyAccount,
    chain: networkConfig.chain,
    transport: http(networkConfig.rpcUrl),
  });

  // Get current balance
  console.log();
  console.log("Fetching wallet balance...");
  const balance = await publicClient.getBalance({
    address: signWith as `0x${string}`,
  });

  console.log();
  console.log("-".repeat(40));
  console.log("Wallet Information");
  console.log("-".repeat(40));
  console.log("Network:     ", network);
  console.log("Address:     ", signWith);
  console.log("Balance:     ", formatEther(balance), "ETH");
  console.log("Destination: ", safeTreasury);
  console.log("-".repeat(40));
  console.log();

  if (balance === 0n) {
    console.log("No ETH to sweep. Wallet is empty.");
    return;
  }

  // Estimate gas cost
  const gasPrice = await publicClient.getGasPrice();
  const gasLimit = 21000n; // Standard ETH transfer
  const gasCost = gasPrice * gasLimit;

  const sweepAmount = balance - gasCost;

  if (sweepAmount <= 0n) {
    console.log("Balance too low to cover gas costs.");
    console.log("Gas cost:", formatEther(gasCost), "ETH");
    return;
  }

  console.log("Estimated gas cost:", formatEther(gasCost), "ETH");
  console.log("Amount to sweep:   ", formatEther(sweepAmount), "ETH");
  console.log();

  // Confirm the sweep
  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: `Sweep ${formatEther(sweepAmount)} ETH to ${safeTreasury}?`,
    initial: false,
  });

  if (!confirm) {
    console.log("Operation cancelled.");
    return;
  }

  // Additional safety check for mainnet
  if (network === "mainnet") {
    const { doubleConfirm } = await prompts({
      type: "text",
      name: "doubleConfirm",
      message:
        'MAINNET TRANSACTION: Type "SWEEP" to confirm (this will move real funds):',
    });

    if (doubleConfirm !== "SWEEP") {
      console.log("Operation cancelled.");
      return;
    }
  }

  // Execute the sweep
  console.log();
  console.log("Executing sweep transaction...");

  try {
    const txHash = await walletClient.sendTransaction({
      to: safeTreasury as `0x${string}`,
      value: sweepAmount,
    });

    console.log();
    console.log("=".repeat(60));
    console.log("SUCCESS: Sweep transaction submitted!");
    console.log("=".repeat(60));
    console.log();
    console.log("Transaction Hash:", txHash);
    console.log(
      "Explorer URL:    ",
      `${networkConfig.explorerUrl}/tx/${txHash}`
    );
    console.log();

    // Wait for confirmation
    console.log("Waiting for transaction confirmation...");
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status === "success") {
      console.log();
      console.log("Transaction confirmed in block:", receipt.blockNumber);
      console.log("Gas used:", receipt.gasUsed.toString());

      // Check new balance
      const newBalance = await publicClient.getBalance({
        address: signWith as `0x${string}`,
      });
      console.log("Remaining balance:", formatEther(newBalance), "ETH");
    } else {
      console.error("Transaction failed!");
    }
  } catch (error: any) {
    console.error("Error executing sweep:", error.message);
    throw error;
  }
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
