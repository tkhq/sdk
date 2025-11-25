import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { solanaNetwork } from "./utils";

async function main() {
  // Create a node connection; if no env var is found, default to public devnet RPC
  const nodeEndpoint =
    process.env.SOLANA_NODE || "https://api.devnet.solana.com";
  const connection = solanaNetwork.connect(nodeEndpoint);

  console.log(`\nConnected to Solana network: ${nodeEndpoint}\n`);

  // Prompt for the signed transaction payload
  const { payload } = await prompts([
    {
      type: "text",
      name: "payload",
      message: "Enter the signed transaction payload (hex or base64):",
      validate: (value) =>
        value && value.trim().length > 0 ? true : "Payload cannot be empty",
    },
  ]);

  if (!payload) {
    console.log("No payload provided. Exiting.");
    process.exit(0);
  }

  let signedTransaction: Transaction | VersionedTransaction;

  try {
    // Try to decode as hex first
    const buffer = Buffer.from(payload.trim(), "hex");

    // Try to deserialize as VersionedTransaction first
    try {
      signedTransaction = VersionedTransaction.deserialize(buffer);
      console.log("\nDetected versioned transaction");
    } catch {
      // Fall back to legacy Transaction
      signedTransaction = Transaction.from(buffer);
      console.log("\nDetected legacy transaction");
    }
  } catch (hexError) {
    try {
      // Try base64 if hex fails
      const buffer = Buffer.from(payload.trim(), "base64");

      try {
        signedTransaction = VersionedTransaction.deserialize(buffer);
        console.log("\nDetected versioned transaction (base64)");
      } catch {
        signedTransaction = Transaction.from(buffer);
        console.log("\nDetected legacy transaction (base64)");
      }
    } catch (base64Error) {
      console.error("\nFailed to decode transaction payload.");
      console.error(
        "Please provide a valid hex or base64 encoded transaction.",
      );
      process.exit(1);
    }
  }

  // Verify signatures for legacy transactions
  if ("verifySignatures" in signedTransaction) {
    const verified = signedTransaction.verifySignatures();
    if (!verified) {
      console.warn(
        "\n⚠️  Warning: Transaction signatures could not be verified",
      );
      const { proceed } = await prompts([
        {
          type: "confirm",
          name: "proceed",
          message: "Do you want to proceed anyway?",
          initial: false,
        },
      ]);

      if (!proceed) {
        console.log("Broadcast cancelled.");
        process.exit(0);
      }
    } else {
      console.log("✓ Transaction signatures verified");
    }
  }

  // Confirm before broadcasting
  const { confirm } = await prompts([
    {
      type: "confirm",
      name: "confirm",
      message: "Ready to broadcast this transaction?",
      initial: true,
    },
  ]);

  if (!confirm) {
    console.log("Broadcast cancelled.");
    process.exit(0);
  }

  // Broadcast the signed transaction
  console.log("\nBroadcasting transaction...");
  await solanaNetwork.broadcast(connection, signedTransaction);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
