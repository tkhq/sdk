/**
 * Path 2: Encryption Key Escrow - Setup
 *
 * This example demonstrates how to set up encryption key escrow for
 * disaster recovery. The workflow:
 *
 * 1. Create an encryption keypair in Turnkey (for encryption only, not on-chain)
 * 2. Get the public key from Turnkey
 * 3. Encrypt your recovery bundle with the public key
 * 4. Store the encrypted bundle in YOUR infrastructure (not Turnkey)
 *
 * Security Properties:
 * - Turnkey never sees your recovery material
 * - Recovery requires BOTH Turnkey authentication AND access to your stored bundle
 * - This is a 2-of-2 security model
 *
 * Usage: pnpm run path2:setup
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import { encryptWithPublicKey } from "../shared/crypto-helpers";

// Polyfill crypto for Node.js
if (typeof crypto === "undefined") {
  (global as any).crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

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
  console.log("Path 2: Encryption Key Escrow - Setup");
  console.log("=".repeat(60));
  console.log();
  console.log("This will:");
  console.log("1. Create an encryption keypair in Turnkey");
  console.log("2. Encrypt your recovery material with Turnkey's public key");
  console.log("3. Save the encrypted bundle locally (you store this securely)");
  console.log();
  console.log(
    "Note: The encrypted bundle should be stored in YOUR infrastructure,"
  );
  console.log("not on Turnkey. This creates a 2-of-2 security model.");
  console.log();

  // Validate environment variables
  const organizationId = process.env.ORGANIZATION_ID;

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

  // Check if we should create a new key or use existing
  const existingKeyId = process.env.ENCRYPTION_KEY_ID;

  let privateKeyId: string;
  let publicKey: string;

  if (existingKeyId) {
    const { useExisting } = await prompts({
      type: "confirm",
      name: "useExisting",
      message: `Found existing ENCRYPTION_KEY_ID (${existingKeyId}). Use this key?`,
      initial: true,
    });

    if (useExisting) {
      console.log();
      console.log("Fetching existing encryption key...");
      const { privateKey } = await turnkeyClient.apiClient().getPrivateKey({
        privateKeyId: existingKeyId,
      });
      privateKeyId = existingKeyId;
      publicKey = privateKey.publicKey;
    } else {
      const result = await createNewEncryptionKey(turnkeyClient);
      privateKeyId = result.privateKeyId;
      publicKey = result.publicKey;
    }
  } else {
    const result = await createNewEncryptionKey(turnkeyClient);
    privateKeyId = result.privateKeyId;
    publicKey = result.publicKey;
  }

  console.log();
  console.log("-".repeat(40));
  console.log("Encryption Key Details");
  console.log("-".repeat(40));
  console.log("Private Key ID:", privateKeyId);
  console.log("Public Key:    ", publicKey.substring(0, 40) + "...");
  console.log("-".repeat(40));
  console.log();

  // Select what type of recovery bundle to create
  const { bundleType } = await prompts({
    type: "select",
    name: "bundleType",
    message: "What type of recovery material are you backing up?",
    choices: [
      { title: "HD Wallet (Mnemonic)", value: "wallet" },
      { title: "API Credentials", value: "credentials" },
      { title: "Custom Data", value: "custom" },
    ],
  });

  if (!bundleType) {
    console.log("Operation cancelled.");
    return;
  }

  // Build the recovery bundle
  const recoveryBundle: RecoveryBundle = {
    version: "1.0",
    createdAt: new Date().toISOString(),
    type: bundleType,
    data: {},
  };

  if (bundleType === "wallet") {
    const { mnemonic } = await prompts({
      type: "password",
      name: "mnemonic",
      message: "Enter the mnemonic seed phrase to back up:",
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

    recoveryBundle.data.mnemonic = mnemonic.trim();
  } else if (bundleType === "credentials") {
    const credentials: Array<{ service: string; apiKey: string }> = [];

    let addMore = true;
    while (addMore) {
      const { service, apiKey } = await prompts([
        {
          type: "text",
          name: "service",
          message: "Service name (e.g., AWS, Infura):",
        },
        {
          type: "password",
          name: "apiKey",
          message: "API Key/Secret:",
        },
      ]);

      if (service && apiKey) {
        credentials.push({ service, apiKey });
      }

      const { more } = await prompts({
        type: "confirm",
        name: "more",
        message: "Add another credential?",
        initial: false,
      });
      addMore = more;
    }

    recoveryBundle.data.credentials = credentials;
  } else {
    const { customData } = await prompts({
      type: "text",
      name: "customData",
      message: "Enter custom recovery data (will be stored as-is):",
    });

    recoveryBundle.data.custom = customData;
  }

  // Add optional metadata
  const { addMetadata } = await prompts({
    type: "confirm",
    name: "addMetadata",
    message: "Add description/metadata to the bundle?",
    initial: false,
  });

  if (addMetadata) {
    const { description, organization } = await prompts([
      {
        type: "text",
        name: "description",
        message: "Description:",
      },
      {
        type: "text",
        name: "organization",
        message: "Organization name:",
      },
    ]);

    recoveryBundle.metadata = { description, organization };
  }

  // Encrypt the bundle
  console.log();
  console.log("Encrypting recovery bundle...");

  const bundleJson = JSON.stringify(recoveryBundle);
  const encryptedBundle = await encryptWithPublicKey(publicKey, bundleJson);

  console.log("Bundle encrypted successfully.");
  console.log();

  // Save the encrypted bundle
  const { outputPath } = await prompts({
    type: "text",
    name: "outputPath",
    message: "Save encrypted bundle to:",
    initial: "./encrypted-recovery-bundle.txt",
  });

  const resolvedPath = path.resolve(process.cwd(), outputPath);
  fs.writeFileSync(
    resolvedPath,
    JSON.stringify(
      {
        version: "1.0",
        encryptionKeyId: privateKeyId,
        organizationId,
        encryptedData: encryptedBundle,
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  console.log();
  console.log("=".repeat(60));
  console.log("SUCCESS: Encryption Key Escrow Setup Complete!");
  console.log("=".repeat(60));
  console.log();
  console.log("Encrypted bundle saved to:", resolvedPath);
  console.log();
  console.log("IMPORTANT - Add to your .env.local:");
  console.log(`ENCRYPTION_KEY_ID="${privateKeyId}"`);
  console.log();
  console.log("IMPORTANT - Store the encrypted bundle securely:");
  console.log("- Move it to your secure storage (S3, vault, etc.)");
  console.log("- DO NOT store it on Turnkey");
  console.log("- Back it up to multiple locations");
  console.log();
  console.log("To recover, run: pnpm run path2:recovery");
}

async function createNewEncryptionKey(
  turnkeyClient: Turnkey
): Promise<{ privateKeyId: string; publicKey: string }> {
  console.log();
  console.log("Step 1: Create encryption keypair in Turnkey");
  console.log("-".repeat(40));

  const { keyName } = await prompts({
    type: "text",
    name: "keyName",
    message: "Name for the encryption key:",
    initial: `DR-Encryption-Key-${Date.now()}`,
  });

  console.log("Creating P-256 encryption keypair...");

  const { privateKeys } = await turnkeyClient.apiClient().createPrivateKeys({
    privateKeys: [
      {
        privateKeyName: keyName,
        curve: "CURVE_P256",
        addressFormats: [], // No blockchain addresses - this is for encryption only
        privateKeyTags: [],
      },
    ],
  });

  const privateKeyId = privateKeys[0].privateKeyId;

  // Get the public key
  const { privateKey } = await turnkeyClient.apiClient().getPrivateKey({
    privateKeyId,
  });

  console.log("Encryption keypair created successfully.");

  return {
    privateKeyId,
    publicKey: privateKey.publicKey,
  };
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
