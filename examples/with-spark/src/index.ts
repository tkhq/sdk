import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { SparkWallet } from "@buildonspark/spark-sdk";
import prompts from "prompts";

type SparkNetwork = "MAINNET" | "REGTEST";

async function main() {
  const network = (process.env.SPARK_NETWORK ?? "REGTEST") as SparkNetwork;
  const existingMnemonic = process.env.MNEMONIC || undefined;

  console.log(`\nInitializing Spark wallet on ${network}...`);

  // Initialize (or restore) a Spark wallet.
  // If no mnemonic is provided, a fresh one is auto-generated.
  const { wallet, mnemonic } = await SparkWallet.initialize({
    ...(existingMnemonic ? { mnemonicOrSeed: existingMnemonic } : {}),
    options: { network },
  });

  if (!existingMnemonic) {
    console.log("\nNew wallet generated. Save this mnemonic somewhere safe:");
    console.log(`  ${mnemonic}`);
    console.log(
      "\nSet MNEMONIC in .env.local to restore this wallet next time.",
    );
  }

  // --- Addressing ---
  const sparkAddress = await wallet.getSingleUseDepositAddress();
  const identityPublicKey = wallet.getIdentityPublicKey();
  const sparkAddr = await wallet.getSparkAddress();

  console.log(`\nSpark address:       ${sparkAddr}`);
  console.log(`Identity public key: ${identityPublicKey}`);
  console.log(`Deposit address:     ${sparkAddress}`);

  // --- Balances ---
  const { balance } = await wallet.getBalance();
  console.log(`\nBalance: ${balance.toLocaleString()} sats`);

  // --- Transfer ---
  const receiverSparkAddress =
    process.env.RECEIVER_SPARK_ADDRESS || undefined;

  if (receiverSparkAddress) {
    const { amountInput } = await prompts({
      type: "text",
      name: "amountInput",
      message: "Amount to transfer (sats):",
      initial: "1000",
    });

    if (!amountInput) {
      console.log("Transfer cancelled.");
      wallet.cleanupConnections();
      return;
    }

    const amountSats = parseInt(amountInput, 10);
    if (isNaN(amountSats) || amountSats <= 0) {
      throw new Error("Invalid amount.");
    }

    console.log(
      `\nTransferring ${amountSats} sats to ${receiverSparkAddress}...`,
    );

    const transfer = await wallet.transfer({
      receiverSparkAddress,
      amountSats,
    });

    console.log(`Transfer complete!`);
    console.log(`  ID:     ${transfer.id}`);
    console.log(`  Status: ${transfer.status}`);
  } else {
    console.log(
      "\nNo RECEIVER_SPARK_ADDRESS set — skipping transfer demo.",
    );
    console.log("Fund your deposit address and set RECEIVER_SPARK_ADDRESS to demo transfers.");
  }

  // --- Recent transfers ---
  const { transfers } = await wallet.getTransfers(5);
  if (transfers.length > 0) {
    console.log(`\nRecent transfers (last ${transfers.length}):`);
    for (const tx of transfers) {
      const direction =
        tx.transferDirection === "TRANSFER_DIRECTION_INCOMING" ? "IN " : "OUT";
      console.log(
        `  [${direction}] ${tx.totalValue?.toLocaleString()} sats — ${tx.status}`,
      );
    }
  }

  wallet.cleanupConnections();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
