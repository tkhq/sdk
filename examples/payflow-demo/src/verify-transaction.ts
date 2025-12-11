import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ethers } from "ethers";
import { getProvider } from "./provider";
import { formatAddress } from "./utils";

const ERC20_TRANSFER_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

async function verifyTransaction(txHash: string, network: string = "sepolia") {
  console.log("Verifying Transaction on Sepolia\n");
  console.log(`Transaction Hash: ${txHash}\n`);

  const provider = getProvider(network);

  try {
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      console.log("Transaction not found (may still be pending)");
      return;
    }

    // Get transaction details
    const tx = await provider.getTransaction(txHash);

    // Display basic transaction info
    console.log("=".repeat(60));
    console.log("TRANSACTION DETAILS");
    console.log("=".repeat(60));
    console.log(`Status:        ${receipt.status === 1 ? "Success" : "Failed"}`);
    console.log(`Block Number:  ${receipt.blockNumber}`);
    console.log(`From:          ${formatAddress(receipt.from)}`);
    console.log(`To:            ${receipt.to ? formatAddress(receipt.to) : "Contract Creation"}`);
    console.log(`Gas Used:      ${receipt.gasUsed.toString()}`);
    if (tx) {
      console.log(`Value:         ${ethers.formatEther(tx.value)} ETH`);
      console.log(`Gas Price:     ${ethers.formatUnits(tx.gasPrice || 0n, "gwei")} gwei`);
    }

    // Parse USDC transfer events
    const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
    const transferLogs = receipt.logs
      .map((log) => {
        try {
          return iface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((parsed) => parsed && parsed.name === "Transfer");

    if (transferLogs.length > 0) {
      console.log("\n" + "=".repeat(60));
      console.log("USDC TRANSFER EVENTS");
      console.log("=".repeat(60));
      transferLogs.forEach((parsed, index) => {
        if (parsed) {
          const amount = ethers.formatUnits(parsed.args.value, 6); // USDC has 6 decimals
          console.log(`\nTransfer #${index + 1}:`);
          console.log(`  From:   ${formatAddress(parsed.args.from)}`);
          console.log(`  To:     ${formatAddress(parsed.args.to)}`);
          console.log(`  Amount: ${amount} USDC`);
        }
      });
    }

    // Display explorer link
    const explorerBase =
      network === "sepolia"
        ? "https://sepolia.etherscan.io"
        : network === "goerli"
          ? "https://goerli.etherscan.io"
          : "https://etherscan.io";

    console.log("\n" + "=".repeat(60));
    console.log("EXPLORER LINK");
    console.log("=".repeat(60));
    console.log(`${explorerBase}/tx/${txHash}\n`);
  } catch (error: any) {
    console.error("Error verifying transaction:");
    console.error(error.message || error);
    process.exit(1);
  }
}

async function main() {
  const txHash = process.argv[2];
  const network = process.env.NETWORK || "sepolia";

  if (!txHash) {
    console.error("Missing transaction hash");
    console.error("\nUsage: npx tsx src/verify-transaction.ts <transactionHash>");
    process.exit(1);
  }

  if (!ethers.isHexString(txHash, 32)) {
    console.error("Invalid transaction hash format");
    process.exit(1);
  }

  await verifyTransaction(txHash, network);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

