/**
 * Path 2: Encryption Key Escrow - Recovery
 *
 * This example demonstrates how to recover from an encrypted backup
 * using encryption key escrow. The workflow:
 *
 * 1. Generate a target keypair for receiving the exported key
 * 2. Export the encryption private key from Turnkey (may require quorum approval)
 * 3. Decrypt the export bundle to get the raw private key
 * 4. Fetch your encrypted recovery bundle from your storage
 * 5. Decrypt the recovery bundle locally
 *
 * Security Properties:
 * - Both Turnkey authentication AND access to your stored bundle are required
 * - The decrypted material only exists momentarily on your device
 * - Quorum policies can require multiple approvers
 *
 * Usage: pnpm run path2:recovery
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import { generateP256KeyPair, decryptExportBundle } from "@turnkey/crypto";
import { decryptWithPrivateKey } from "../shared/crypto-helpers";

// Polyfill crypto for Node.js
if (typeof crypto === "undefined") {
  (global as any).crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

interface StoredBundle {
  version: string;
  encryptionKeyId: string;
  organizationId: string;
  encryptedData: string;
  createdAt: string;
}

interface RecoveryBundle {
  version: string;
  createdAt: string;
  type: "wallet" | "credentials" | "custom";
  data: {
    mnemonic?: string;
    privateKeys?: Array<{
      name: string;
      key: string;
      chain: string;
    }>;
    credentials?: Array<{
      service: string;
      apiKey: string;
    }>;
    custom?: string;
  };
  metadata?: {
    description?: string;
    organization?: string;
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("Path 2: Encryption Key Escrow - Recovery");
  console.log("=".repeat(60));
  console.log();
  console.log("This will:");
  console.log("1. Export the encryption key from Turnkey");
  console.log("2. Load your encrypted recovery bundle");
  console.log("3. Decrypt and display the recovery material");
  console.log();
  console.log(
    "WARNING: The decrypted material will be displayed on screen."
  );
  console.log("Ensure you are in a secure environment.");
  console.log();

  // Validate environment variables
  const organizationId = process.env.ORGANIZATION_ID;
  const encryptionKeyId = process.env.ENCRYPTION_KEY_ID;

  if (!organizationId) {
    throw new Error("Missing required environment variable: ORGANIZATION_ID");
  }

  // Initialize Turnkey client
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: organizationId,
  });

  // Get the encrypted bundle path
  const { bundlePath } = await prompts({
    type: "text",
    name: "bundlePath",
    message: "Path to encrypted recovery bundle:",
    initial: "./encrypted-recovery-bundle.txt",
    validate: (value) => {
      const resolved = path.resolve(process.cwd(), value);
      if (!fs.existsSync(resolved)) {
        return `File not found: ${resolved}`;
      }
      return true;
    },
  });

  if (!bundlePath) {
    console.log("Operation cancelled.");
    return;
  }

  // Load the encrypted bundle
  console.log();
  console.log("Loading encrypted bundle...");

  const bundleContents = fs.readFileSync(
    path.resolve(process.cwd(), bundlePath),
    "utf-8"
  );
  const storedBundle: StoredBundle = JSON.parse(bundleContents);

  console.log("Bundle loaded successfully.");
  console.log("  Created at:", storedBundle.createdAt);
  console.log("  Encryption Key ID:", storedBundle.encryptionKeyId);
  console.log();

  // Use the key ID from the bundle or environment
  const keyIdToUse = storedBundle.encryptionKeyId || encryptionKeyId;

  if (!keyIdToUse) {
    throw new Error(
      "No encryption key ID found in bundle or ENCRYPTION_KEY_ID environment variable"
    );
  }

  // Confirm before proceeding
  const { confirmExport } = await prompts({
    type: "confirm",
    name: "confirmExport",
    message: `Export encryption key (${keyIdToUse}) from Turnkey?`,
    initial: false,
  });

  if (!confirmExport) {
    console.log("Operation cancelled.");
    return;
  }

  console.log();
  console.log("Step 1: Generate target keypair for export");
  console.log("-".repeat(40));

  // Generate a target keypair to receive the exported key
  const targetKeyPair = generateP256KeyPair();
  console.log("Target keypair generated.");
  console.log();

  console.log("Step 2: Export encryption key from Turnkey");
  console.log("-".repeat(40));
  console.log("Note: This may require quorum approval if configured.");
  console.log();

  try {
    const exportResult = await turnkeyClient.apiClient().exportPrivateKey({
      privateKeyId: keyIdToUse,
      targetPublicKey: targetKeyPair.publicKeyUncompressed,
    });

    console.log("Key exported successfully.");
    console.log();

    console.log("Step 3: Decrypt the export bundle");
    console.log("-".repeat(40));

    const decryptedKeyBundle = await decryptExportBundle({
      exportBundle: exportResult.exportBundle,
      embeddedKey: targetKeyPair.privateKey,
      organizationId: storedBundle.organizationId || organizationId,
      returnMnemonic: false,
    });

    console.log("Export bundle decrypted.");
    console.log();

    console.log("Step 4: Decrypt recovery bundle");
    console.log("-".repeat(40));

    // The decrypted key bundle contains the private key in hex format
    const encryptionPrivateKey =
      typeof decryptedKeyBundle === "string"
        ? decryptedKeyBundle
        : decryptedKeyBundle.privateKey;

    const decryptedRecoveryJson = await decryptWithPrivateKey(
      encryptionPrivateKey,
      storedBundle.encryptedData
    );

    const recoveryBundle: RecoveryBundle = JSON.parse(decryptedRecoveryJson);

    // Display the recovered data
    console.log();
    console.log("=".repeat(60));
    console.log("RECOVERY SUCCESSFUL");
    console.log("=".repeat(60));
    console.log();

    // Security warning
    console.log(
      "WARNING: Sensitive data displayed below. Clear your terminal after use."
    );
    console.log();

    const { showData } = await prompts({
      type: "confirm",
      name: "showData",
      message: "Display decrypted recovery data?",
      initial: false,
    });

    if (showData) {
      console.log("-".repeat(40));
      console.log("Recovery Bundle Details");
      console.log("-".repeat(40));
      console.log("Type:       ", recoveryBundle.type);
      console.log("Created at: ", recoveryBundle.createdAt);

      if (recoveryBundle.metadata) {
        console.log("Description:", recoveryBundle.metadata.description || "N/A");
        console.log(
          "Organization:",
          recoveryBundle.metadata.organization || "N/A"
        );
      }

      console.log();
      console.log("-".repeat(40));
      console.log("Recovered Data");
      console.log("-".repeat(40));

      if (recoveryBundle.type === "wallet" && recoveryBundle.data.mnemonic) {
        console.log();
        console.log("MNEMONIC SEED PHRASE:");
        console.log(recoveryBundle.data.mnemonic);
        console.log();
      } else if (
        recoveryBundle.type === "credentials" &&
        recoveryBundle.data.credentials
      ) {
        console.log();
        console.log("CREDENTIALS:");
        for (const cred of recoveryBundle.data.credentials) {
          console.log(`  ${cred.service}: ${cred.apiKey}`);
        }
        console.log();
      } else if (recoveryBundle.type === "custom" && recoveryBundle.data.custom) {
        console.log();
        console.log("CUSTOM DATA:");
        console.log(recoveryBundle.data.custom);
        console.log();
      }

      console.log("-".repeat(40));
    }

    // Optionally save to file
    const { saveToFile } = await prompts({
      type: "confirm",
      name: "saveToFile",
      message: "Save decrypted data to file?",
      initial: false,
    });

    if (saveToFile) {
      const { outputPath } = await prompts({
        type: "text",
        name: "outputPath",
        message: "Save decrypted bundle to:",
        initial: "./decrypted-recovery-bundle.json",
      });

      const resolvedOutput = path.resolve(process.cwd(), outputPath);
      fs.writeFileSync(
        resolvedOutput,
        JSON.stringify(recoveryBundle, null, 2)
      );
      console.log();
      console.log("Decrypted bundle saved to:", resolvedOutput);
      console.log("SECURITY: Delete this file after use!");
    }

    console.log();
    console.log("=".repeat(60));
    console.log("Recovery process complete.");
    console.log("Remember to clear your terminal and any saved files.");
    console.log("=".repeat(60));
  } catch (error: any) {
    if (error.message?.includes("consensus")) {
      console.log();
      console.log("=".repeat(60));
      console.log("QUORUM APPROVAL REQUIRED");
      console.log("=".repeat(60));
      console.log();
      console.log(
        "This export requires additional approvals based on your policy."
      );
      console.log(
        "Please coordinate with other key holders to complete the export."
      );
      console.log();
    } else {
      throw error;
    }
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
