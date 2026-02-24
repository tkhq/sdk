/**
 * Path 1: Direct Wallet Import - Import Raw Private Key
 *
 * This example demonstrates how to import a raw private key
 * into Turnkey's secure enclaves for disaster recovery.
 *
 * Supports:
 * - Ethereum/EVM (SECP256K1)
 * - Solana (ED25519)
 *
 * Security Note: In production, perform the encryption step on an air-gapped
 * machine and transport only the encrypted bundle.
 *
 * Usage: pnpm run path1:import-key
 */

import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import { encryptPrivateKeyToBundle } from "@turnkey/crypto";

// Polyfill crypto for Node.js
if (typeof crypto === "undefined") {
  (global as any).crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Key type configurations
const KEY_TYPES = {
  ethereum: {
    label: "Ethereum/EVM (SECP256K1)",
    keyFormat: "HEXADECIMAL" as const,
    curve: "CURVE_SECP256K1" as const,
    addressFormats: ["ADDRESS_FORMAT_ETHEREUM"] as const,
  },
  solana: {
    label: "Solana (ED25519)",
    keyFormat: "SOLANA" as const,
    curve: "CURVE_ED25519" as const,
    addressFormats: ["ADDRESS_FORMAT_SOLANA"] as const,
  },
  bitcoin: {
    label: "Bitcoin (SECP256K1)",
    keyFormat: "HEXADECIMAL" as const,
    curve: "CURVE_SECP256K1" as const,
    addressFormats: [
      "ADDRESS_FORMAT_BITCOIN_MAINNET_P2PKH",
      "ADDRESS_FORMAT_BITCOIN_MAINNET_P2WPKH",
    ] as const,
  },
};

async function main() {
  console.log("=".repeat(60));
  console.log("Path 1: Direct Wallet Import - Raw Private Key");
  console.log("=".repeat(60));
  console.log();

  // Validate environment variables
  const organizationId = process.env.ORGANIZATION_ID;
  const userId = process.env.USER_ID;

  if (!organizationId || !userId) {
    throw new Error(
      "Missing required environment variables: ORGANIZATION_ID, USER_ID"
    );
  }

  // Initialize Turnkey client
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  // Select key type
  const { keyType } = await prompts({
    type: "select",
    name: "keyType",
    message: "Select the key type:",
    choices: [
      { title: KEY_TYPES.ethereum.label, value: "ethereum" },
      { title: KEY_TYPES.solana.label, value: "solana" },
      { title: KEY_TYPES.bitcoin.label, value: "bitcoin" },
    ],
  });

  if (!keyType) {
    console.log("Operation cancelled.");
    return;
  }

  const keyConfig = KEY_TYPES[keyType as keyof typeof KEY_TYPES];

  console.log();
  console.log("Step 1: Initialize import bundle from Turnkey");
  console.log("-".repeat(40));

  // Step 1: Initialize the import
  const initResult = await turnkeyClient.apiClient().initImportPrivateKey({
    userId,
  });

  console.log("Import bundle received from Turnkey enclave.");
  console.log();

  // Step 2: Get the private key from user
  console.log("Step 2: Encrypt private key material");
  console.log("-".repeat(40));
  console.log(
    "SECURITY WARNING: In production, perform this step on an air-gapped machine!"
  );
  console.log();

  const { privateKey } = await prompts({
    type: "password",
    name: "privateKey",
    message: `Enter your ${keyConfig.label} private key:`,
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Private key is required";
      }
      return true;
    },
  });

  if (!privateKey) {
    console.log("Operation cancelled.");
    return;
  }

  const { keyName } = await prompts({
    type: "text",
    name: "keyName",
    message: "Enter a name for this DR key:",
    initial: `DR-Key-${keyType.toUpperCase()}-${Date.now()}`,
  });

  // Encrypt the private key
  console.log();
  console.log("Encrypting private key material...");
  const encryptedBundle = await encryptPrivateKeyToBundle({
    privateKey: privateKey.trim(),
    keyFormat: keyConfig.keyFormat,
    importBundle: initResult.importBundle,
    userId,
    organizationId,
  });

  console.log("Private key material encrypted successfully.");
  console.log();

  // Step 3: Import the encrypted key into Turnkey
  console.log("Step 3: Import encrypted key to Turnkey");
  console.log("-".repeat(40));

  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: `Import key "${keyName}" to Turnkey?`,
    initial: true,
  });

  if (!confirm) {
    console.log("Operation cancelled.");
    return;
  }

  const importResult = await turnkeyClient.apiClient().importPrivateKey({
    userId,
    privateKeyName: keyName,
    encryptedBundle,
    curve: keyConfig.curve,
    addressFormats: [...keyConfig.addressFormats],
  });

  console.log();
  console.log("=".repeat(60));
  console.log("SUCCESS: Private key imported successfully!");
  console.log("=".repeat(60));
  console.log();
  console.log("Private Key ID:", importResult.privateKeyId);
  console.log("Addresses:", importResult.addresses);
  console.log();
  console.log("Next steps:");
  console.log("1. Configure quorum policies for DR access");
  console.log("2. Test fund sweeping with a small amount");
  console.log();
  console.log(
    "To sweep funds from this key, update SIGN_WITH in .env.local and run:"
  );
  console.log("  pnpm run path1:sweep-funds");
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
