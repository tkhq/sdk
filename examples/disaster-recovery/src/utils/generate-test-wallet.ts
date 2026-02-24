#!/usr/bin/env node
/**
 * Generate Test Wallet
 *
 * Creates test mnemonics and private keys for testing the disaster recovery
 * import flows. These are for TESTING ONLY - never use for real funds!
 *
 * Usage: pnpm run generate-test-wallet
 */

import prompts from "prompts";
import {
  generateMnemonic,
  mnemonicToAccount,
  privateKeyToAccount,
  english,
} from "viem/accounts";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           GENERATE TEST WALLET FOR DR TESTING              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("⚠️  WARNING: These wallets are for TESTING ONLY!");
  console.log("    Do not use for real funds in production.");
  console.log();

  const { walletType } = await prompts({
    type: "select",
    name: "walletType",
    message: "What would you like to generate?",
    choices: [
      {
        title: "HD Wallet (Mnemonic) - Recommended",
        description: "12 or 24 word seed phrase",
        value: "mnemonic",
      },
      {
        title: "Raw Private Key",
        description: "Single Ethereum private key",
        value: "privatekey",
      },
      {
        title: "Both",
        description: "Generate both for testing",
        value: "both",
      },
    ],
  });

  if (!walletType) {
    console.log("Cancelled.");
    return;
  }

  const results: any = {};

  if (walletType === "mnemonic" || walletType === "both") {
    results.mnemonic = await generateMnemonicWallet();
  }

  if (walletType === "privatekey" || walletType === "both") {
    results.privateKey = await generatePrivateKey();
  }

  // Offer to save to file
  const { saveToFile } = await prompts({
    type: "confirm",
    name: "saveToFile",
    message: "Save to file for easy reference?",
    initial: true,
  });

  if (saveToFile) {
    const filename = `test-wallet-${Date.now()}.json`;
    const filepath = path.resolve(process.cwd(), filename);

    fs.writeFileSync(
      filepath,
      JSON.stringify(
        {
          warning: "TEST WALLET ONLY - DO NOT USE FOR REAL FUNDS",
          createdAt: new Date().toISOString(),
          ...results,
        },
        null,
        2
      )
    );

    console.log();
    console.log(`✓ Saved to ${filename}`);
  }

  // Show next steps
  console.log();
  console.log("═".repeat(60));
  console.log("NEXT STEPS:");
  console.log("═".repeat(60));
  console.log();

  if (results.mnemonic) {
    console.log("To import the HD wallet:");
    console.log("  pnpm run path1:import-wallet");
    console.log(`  → Enter the mnemonic when prompted`);
    console.log();
  }

  if (results.privateKey) {
    console.log("To import the private key:");
    console.log("  pnpm run path1:import-key");
    console.log(`  → Select "Ethereum/EVM"`);
    console.log(`  → Enter the private key when prompted`);
    console.log();
  }

  console.log("To test fund sweeping (Sepolia testnet):");
  console.log("  1. Get test ETH from a faucet:");
  console.log("     https://sepoliafaucet.com");
  console.log("     https://www.alchemy.com/faucets/ethereum-sepolia");
  if (results.mnemonic) {
    console.log(`  2. Send to: ${results.mnemonic.address}`);
  } else if (results.privateKey) {
    console.log(`  2. Send to: ${results.privateKey.address}`);
  }
  console.log("  3. After importing, run: pnpm run path1:sweep-funds");
  console.log();
}

async function generateMnemonicWallet() {
  const { wordCount } = await prompts({
    type: "select",
    name: "wordCount",
    message: "Mnemonic length:",
    choices: [
      { title: "12 words (standard)", value: 12 },
      { title: "24 words (more secure)", value: 24 },
    ],
  });

  // Generate mnemonic based on word count
  // 12 words = 128 bits of entropy, 24 words = 256 bits
  const strength = wordCount === 24 ? 256 : 128;

  // Generate random bytes for entropy
  const entropy = crypto.getRandomValues(new Uint8Array(strength / 8));

  // Use viem's generateMnemonic with the entropy
  const mnemonic = generateMnemonic(english, strength);

  // Derive account from mnemonic
  const account = mnemonicToAccount(mnemonic);

  console.log();
  console.log("─".repeat(60));
  console.log("HD WALLET (MNEMONIC)");
  console.log("─".repeat(60));
  console.log();
  console.log("Mnemonic Seed Phrase:");
  console.log();

  // Display mnemonic in a grid format
  const words = mnemonic.split(" ");
  const columns = wordCount === 24 ? 4 : 3;
  for (let i = 0; i < words.length; i += columns) {
    const row = words
      .slice(i, i + columns)
      .map((word, idx) => `${String(i + idx + 1).padStart(2)}. ${word.padEnd(10)}`)
      .join("  ");
    console.log(`  ${row}`);
  }

  console.log();
  console.log(`Derived Ethereum Address: ${account.address}`);
  console.log("─".repeat(60));

  return {
    mnemonic,
    wordCount,
    address: account.address,
    derivationPath: "m/44'/60'/0'/0/0",
  };
}

async function generatePrivateKey() {
  // Generate a random 32-byte private key
  const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const privateKeyHex =
    "0x" +
    Array.from(privateKeyBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  // Derive account from private key
  const account = privateKeyToAccount(privateKeyHex as `0x${string}`);

  console.log();
  console.log("─".repeat(60));
  console.log("RAW PRIVATE KEY");
  console.log("─".repeat(60));
  console.log();
  console.log(`Private Key: ${privateKeyHex}`);
  console.log();
  console.log(`Ethereum Address: ${account.address}`);
  console.log("─".repeat(60));

  return {
    privateKey: privateKeyHex,
    address: account.address,
    curve: "secp256k1",
  };
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
