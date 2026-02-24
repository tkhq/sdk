/**
 * Path 1: Direct Wallet Import - Import HD Wallet (Mnemonic)
 *
 * This example demonstrates how to import an HD wallet (BIP-39 mnemonic)
 * into Turnkey's secure enclaves for disaster recovery.
 *
 * Security Note: In production, perform the encryption step on an air-gapped
 * machine and transport only the encrypted bundle.
 *
 * Usage: pnpm run path1:import-wallet
 */

import * as dotenv from "dotenv";
import * as path from "path";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import { encryptWalletToBundle } from "@turnkey/crypto";

// Polyfill crypto for Node.js
if (typeof crypto === "undefined") {
  (global as any).crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  console.log("=".repeat(60));
  console.log("Path 1: Direct Wallet Import - HD Wallet (Mnemonic)");
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

  console.log("Step 1: Initialize import bundle from Turnkey");
  console.log("-".repeat(40));
  console.log(
    "This creates a temporary public key in Turnkey's enclave for encrypting your mnemonic."
  );
  console.log();

  // Step 1: Initialize the import - get a temporary encryption key from Turnkey
  const initResult = await turnkeyClient.apiClient().initImportWallet({
    userId,
  });

  console.log("Import bundle received from Turnkey enclave.");
  console.log();

  // Step 2: Get the mnemonic from user (in production, this would be done offline)
  console.log("Step 2: Encrypt wallet material");
  console.log("-".repeat(40));
  console.log(
    "SECURITY WARNING: In production, perform this step on an air-gapped machine!"
  );
  console.log();

  const { mnemonic } = await prompts({
    type: "password",
    name: "mnemonic",
    message: "Enter your BIP-39 mnemonic seed phrase:",
    validate: (value) => {
      const words = value.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        return "Mnemonic must be 12 or 24 words";
      }
      return true;
    },
  });

  if (!mnemonic) {
    console.log("Operation cancelled.");
    return;
  }

  const { walletName } = await prompts({
    type: "text",
    name: "walletName",
    message: "Enter a name for this DR wallet:",
    initial: `DR-Wallet-${Date.now()}`,
  });

  // Encrypt the mnemonic to Turnkey's ephemeral public key
  console.log();
  console.log("Encrypting wallet material...");
  const encryptedBundle = await encryptWalletToBundle({
    mnemonic,
    importBundle: initResult.importBundle,
    userId,
    organizationId,
  });

  console.log("Wallet material encrypted successfully.");
  console.log();

  // Step 3: Import the encrypted wallet into Turnkey
  console.log("Step 3: Import encrypted wallet to Turnkey");
  console.log("-".repeat(40));

  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: `Import wallet "${walletName}" to Turnkey?`,
    initial: true,
  });

  if (!confirm) {
    console.log("Operation cancelled.");
    return;
  }

  const importResult = await turnkeyClient.apiClient().importWallet({
    userId,
    walletName,
    encryptedBundle,
    accounts: [],
  });

  console.log();
  console.log("=".repeat(60));
  console.log("SUCCESS: Wallet imported successfully!");
  console.log("=".repeat(60));
  console.log();
  console.log("Wallet ID:", importResult.walletId);
  console.log();
  console.log("Next steps:");
  console.log(
    "1. Create wallet accounts for the chains you need (Ethereum, Bitcoin, etc.)"
  );
  console.log("2. Configure quorum policies for DR access");
  console.log("3. Test fund sweeping with a small amount");
  console.log();
  console.log(
    "To sweep funds from this wallet, run: pnpm run path1:sweep-funds"
  );
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
