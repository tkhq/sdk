#!/usr/bin/env node
/**
 * Encryption Key Escrow Interactive CLI
 *
 * Demonstrates how to use Turnkey as a secure key storage and retrieval
 * service rather than relying on Turnkey for signing operations directly.
 *
 * The Pattern (2-of-2 Security Model):
 * - Encrypted data: Stored in YOUR infrastructure (Turnkey never sees it)
 * - Encryption key: Stored in Turnkey's secure enclave
 * - Both components required to decrypt
 *
 * Use Cases:
 * - High-performance multi-wallet signing (export key once, sign locally)
 * - User-controlled backup & recovery (like World App's Turnkey integration)
 * - Distributed trust models (key material separated from encrypted data)
 *
 * Usage: pnpm start
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import { generateP256KeyPair, decryptExportBundle } from "@turnkey/crypto";
import {
  generateMnemonic,
  mnemonicToAccount,
  privateKeyToAccount,
  english,
  HDKey,
} from "viem/accounts";
import {
  encryptWithPublicKey,
  decryptWithPrivateKey,
  secureWipe,
  hexToBytes,
} from "./shared/crypto-helpers";

// Polyfill crypto for Node.js
if (typeof crypto === "undefined") {
  (global as any).crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ============================================================================
// Types
// ============================================================================

interface EncryptedBundle {
  id: string;
  name: string;
  encryptedData: string;
  address?: string;
  createdAt: string;
}

interface EncryptedStore {
  version: string;
  encryptionKeyId: string;
  organizationId: string;
  bundles: EncryptedBundle[];
  createdAt: string;
  updatedAt: string;
}

interface DecryptedEntry {
  id: string;
  name: string;
  privateKey?: string;
  address?: string;
  data?: string;
}

// In-memory session state
let activeSession: {
  decryptionKey: string | null;
  decryptedWallets: DecryptedEntry[];
  startedAt: Date | null;
} = {
  decryptionKey: null,
  decryptedWallets: [],
  startedAt: null,
};

// ============================================================================
// Turnkey Client
// ============================================================================

function getTurnkeyClient(): Turnkey {
  const apiPublicKey = process.env.API_PUBLIC_KEY;
  const apiPrivateKey = process.env.API_PRIVATE_KEY;
  const organizationId = process.env.ORGANIZATION_ID;
  const baseUrl = process.env.BASE_URL ?? "https://api.turnkey.com";

  if (!apiPublicKey || !apiPrivateKey || !organizationId) {
    throw new Error(
      "Missing required environment variables: API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID\n" +
        "Please copy .env.local.example to .env.local and fill in your credentials."
    );
  }

  return new Turnkey({
    apiBaseUrl: baseUrl,
    apiPublicKey,
    apiPrivateKey,
    defaultOrganizationId: organizationId,
  });
}

// ============================================================================
// Main Menu
// ============================================================================

async function mainMenu(): Promise<void> {
  console.clear();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         ENCRYPTION KEY ESCROW                              ║");
  console.log("║   Turnkey as Secure Key Storage & Retrieval Service        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("2-of-2 Security Model:");
  console.log("  • Encrypted data → Your infrastructure (Turnkey never sees it)");
  console.log("  • Encryption key → Turnkey secure enclave");
  console.log();

  while (true) {
    const sessionStatus = activeSession.decryptionKey
      ? `🟢 Active (${activeSession.decryptedWallets.length} entries)`
      : "⚪ No active session";

    const { action } = await prompts({
      type: "select",
      name: "action",
      message: `Session: ${sessionStatus} | What would you like to do?`,
      choices: [
        {
          title: "─── Setup (One-Time) ───",
          value: "separator1",
          disabled: true,
        },
        {
          title: "Create Encryption Key in Turnkey",
          description: "P-256 keypair stored in Turnkey's secure enclave",
          value: "create-key",
        },
        {
          title: "Generate & Encrypt Test Data",
          description: "Create wallets/credentials and encrypt locally",
          value: "generate-wallets",
        },
        {
          title: "Encrypt Custom Data",
          description: "Encrypt your own data with the escrow key",
          value: "encrypt-custom",
        },
        {
          title: "─── On-Demand Access ───",
          value: "separator2",
          disabled: true,
        },
        {
          title: "Export Key & Decrypt Data",
          description: "Retrieve decryption key from Turnkey, decrypt locally",
          value: "start-session",
        },
        {
          title: "Use Decrypted Data (Demo)",
          description: "Sign a message with decrypted wallet",
          value: "sign-demo",
          disabled: !activeSession.decryptionKey,
        },
        {
          title: "Clear Sensitive Data",
          description: "Wipe decryption key and decrypted data from memory",
          value: "end-session",
          disabled: !activeSession.decryptionKey,
        },
        {
          title: "─────────────────────────────────",
          value: "separator3",
          disabled: true,
        },
        {
          title: "View Encrypted Store",
          description: "Inspect encrypted bundles (Turnkey never sees this)",
          value: "view-store",
        },
        { title: "Exit", value: "exit" },
      ],
    });

    if (!action || action === "exit") {
      if (activeSession.decryptionKey) {
        console.log("Ending active session before exit...");
        endSession();
      }
      console.log("Goodbye!");
      return;
    }

    console.log();

    try {
      switch (action) {
        case "create-key":
          await createEncryptionKey();
          break;
        case "generate-wallets":
          await generateAndEncryptWallets();
          break;
        case "encrypt-custom":
          await encryptCustomData();
          break;
        case "start-session":
          await startSession();
          break;
        case "sign-demo":
          await signDemo();
          break;
        case "end-session":
          endSession();
          break;
        case "view-store":
          await viewEncryptedStore();
          break;
      }
    } catch (error: any) {
      console.error();
      console.error("Error:", error.message);
    }

    console.log();
    await prompts({
      type: "text",
      name: "continue",
      message: "Press Enter to continue...",
    });
    console.clear();
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║         ENCRYPTION KEY ESCROW                              ║");
    console.log("║   Turnkey as Secure Key Storage & Retrieval Service        ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log();
    console.log("2-of-2 Security Model:");
    console.log("  • Encrypted data → Your infrastructure (Turnkey never sees it)");
    console.log("  • Encryption key → Turnkey secure enclave");
    console.log();
  }
}

// ============================================================================
// Initial Setup: Create Encryption Key
// ============================================================================

async function createEncryptionKey(): Promise<void> {
  console.log("─".repeat(60));
  console.log("CREATE ENCRYPTION KEY IN TURNKEY");
  console.log("─".repeat(60));
  console.log();
  console.log("This creates a P-256 keypair in Turnkey's secure enclave.");
  console.log();
  console.log("How it works:");
  console.log("  • Public key: You use this to encrypt data locally");
  console.log("  • Private key: Stays in Turnkey, exported only on-demand");
  console.log("  • Turnkey never sees your encrypted data");
  console.log();

  const existingKeyId = process.env.ENCRYPTION_KEY_ID;

  if (existingKeyId) {
    const { useExisting } = await prompts({
      type: "confirm",
      name: "useExisting",
      message: `Found existing ENCRYPTION_KEY_ID (${existingKeyId.slice(0, 20)}...). Use this key?`,
      initial: true,
    });

    if (useExisting) {
      console.log("Using existing encryption key.");
      return;
    }
  }

  const turnkeyClient = getTurnkeyClient();

  const { keyName } = await prompts({
    type: "text",
    name: "keyName",
    message: "Name for the encryption key:",
    initial: `Escrow-Key-${Date.now()}`,
  });

  if (!keyName) return;

  console.log();
  console.log("Creating P-256 encryption keypair in Turnkey...");

  const { privateKeys } = await turnkeyClient.apiClient().createPrivateKeys({
    privateKeys: [
      {
        privateKeyName: keyName,
        curve: "CURVE_P256" as any,
        addressFormats: [],
        privateKeyTags: [],
      },
    ],
  });

  const privateKeyId = privateKeys[0].privateKeyId!;

  // Fetch the public key
  const { privateKey } = await turnkeyClient.apiClient().getPrivateKey({
    privateKeyId,
  });

  console.log();
  console.log("═".repeat(60));
  console.log("SUCCESS: Encryption key created!");
  console.log("═".repeat(60));
  console.log();
  console.log("Private Key ID:", privateKeyId);
  console.log("Public Key:    ", privateKey.publicKey.slice(0, 40) + "...");
  console.log();
  console.log("IMPORTANT - Add to your .env.local:");
  console.log(`ENCRYPTION_KEY_ID="${privateKeyId}"`);
  console.log();
}

// ============================================================================
// Initial Setup: Generate & Encrypt Wallets
// ============================================================================

async function generateAndEncryptWallets(): Promise<void> {
  console.log("─".repeat(60));
  console.log("GENERATE & ENCRYPT TEST DATA");
  console.log("─".repeat(60));
  console.log();
  console.log("This demonstrates encrypting sensitive data with Turnkey's public key.");
  console.log("In production, this could be: wallets, recovery bundles, credentials, etc.");
  console.log();
  console.log("Key point: Turnkey NEVER sees the plaintext or encrypted data.");
  console.log("You store the encrypted bundles in YOUR infrastructure.");
  console.log();

  const encryptionKeyId = process.env.ENCRYPTION_KEY_ID;
  const organizationId = process.env.ORGANIZATION_ID;

  if (!encryptionKeyId) {
    throw new Error(
      "Missing ENCRYPTION_KEY_ID. Run 'Create Encryption Key' first."
    );
  }

  const turnkeyClient = getTurnkeyClient();

  // Get the encryption public key
  console.log("Fetching encryption public key from Turnkey...");
  const { privateKey: encryptionKey } = await turnkeyClient
    .apiClient()
    .getPrivateKey({
      privateKeyId: encryptionKeyId,
    });

  const publicKey = encryptionKey.publicKey;
  console.log("Public key retrieved.");
  console.log();

  const { walletType } = await prompts({
    type: "select",
    name: "walletType",
    message: "What type of wallets to generate?",
    choices: [
      {
        title: "HD Wallet (derive multiple addresses from mnemonic)",
        value: "hd",
      },
      { title: "Individual Private Keys", value: "individual" },
    ],
  });

  if (!walletType) return;

  const { walletCount } = await prompts({
    type: "number",
    name: "walletCount",
    message: "How many wallets to generate?",
    initial: 10,
    min: 1,
    max: 100,
  });

  if (!walletCount) return;

  console.log();
  console.log(`Generating ${walletCount} wallets...`);

  const bundles: EncryptedBundle[] = [];

  if (walletType === "hd") {
    // Generate HD wallet
    const mnemonic = generateMnemonic(english, 256);
    const hdKey = HDKey.fromMasterSeed(
      new Uint8Array(mnemonicToAccount(mnemonic).getHdKey().privateKey!)
    );

    console.log("HD wallet generated. Deriving addresses...");

    for (let i = 0; i < walletCount; i++) {
      const derivationPath = `m/44'/60'/0'/0/${i}`;
      const derived = hdKey.derive(derivationPath);
      const privateKeyHex =
        "0x" +
        Buffer.from(derived.privateKey!).toString("hex");
      const account = privateKeyToAccount(privateKeyHex as `0x${string}`);

      // Encrypt the private key
      const walletData = JSON.stringify({
        type: "hd-derived",
        privateKey: privateKeyHex,
        derivationPath,
        index: i,
      });

      const encryptedData = await encryptWithPublicKey(publicKey, walletData);

      bundles.push({
        id: `wallet-${i}`,
        name: `HD Wallet #${i}`,
        encryptedData,
        address: account.address,
        createdAt: new Date().toISOString(),
      });

      process.stdout.write(`\r  Encrypted ${i + 1}/${walletCount} wallets`);
    }
    console.log();
  } else {
    // Generate individual private keys
    for (let i = 0; i < walletCount; i++) {
      const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      const privateKeyHex =
        "0x" +
        Array.from(privateKeyBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

      const account = privateKeyToAccount(privateKeyHex as `0x${string}`);

      // Encrypt the private key
      const walletData = JSON.stringify({
        type: "individual",
        privateKey: privateKeyHex,
      });

      const encryptedData = await encryptWithPublicKey(publicKey, walletData);

      bundles.push({
        id: `wallet-${i}`,
        name: `Wallet #${i}`,
        encryptedData,
        address: account.address,
        createdAt: new Date().toISOString(),
      });

      process.stdout.write(`\r  Encrypted ${i + 1}/${walletCount} wallets`);
    }
    console.log();
  }

  // Save to store
  const store: EncryptedStore = {
    version: "1.0",
    encryptionKeyId,
    organizationId: organizationId!,
    bundles,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const storePath = path.resolve(process.cwd(), "encrypted-wallet-store.json");
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

  console.log();
  console.log("═".repeat(60));
  console.log("SUCCESS: Data encrypted and stored locally!");
  console.log("═".repeat(60));
  console.log();
  console.log("Bundles created:", bundles.length);
  console.log("Store saved to:  encrypted-wallet-store.json");
  console.log();
  console.log("Sample addresses:");
  bundles.slice(0, 3).forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.address}`);
  });
  if (bundles.length > 3) {
    console.log(`  ... and ${bundles.length - 3} more`);
  }
  console.log();
  console.log("─".repeat(60));
  console.log("Security Model Now Active:");
  console.log("─".repeat(60));
  console.log("  ✓ Encrypted bundles: YOUR infrastructure (this file)");
  console.log("  ✓ Decryption key:    Turnkey secure enclave");
  console.log("  ✓ Turnkey never saw: The plaintext data");
  console.log();
  console.log("To decrypt, you must authenticate to Turnkey and export the key.");
}

// ============================================================================
// Encrypt Custom Data
// ============================================================================

async function encryptCustomData(): Promise<void> {
  console.log("─".repeat(60));
  console.log("ENCRYPT CUSTOM DATA");
  console.log("─".repeat(60));
  console.log();
  console.log("Encrypt any data you choose with the Turnkey escrow key.");
  console.log("The encrypted bundle is stored locally — Turnkey never sees it.");
  console.log();

  const encryptionKeyId = process.env.ENCRYPTION_KEY_ID;
  const organizationId = process.env.ORGANIZATION_ID;

  if (!encryptionKeyId) {
    throw new Error(
      "Missing ENCRYPTION_KEY_ID. Run 'Create Encryption Key' first."
    );
  }

  const { name } = await prompts({
    type: "text",
    name: "name",
    message: "Label for this entry:",
    initial: `Custom-${Date.now()}`,
  });

  if (!name) return;

  const { data } = await prompts({
    type: "text",
    name: "data",
    message: "Data to encrypt:",
  });

  if (!data) return;

  const turnkeyClient = getTurnkeyClient();

  console.log();
  console.log("Fetching encryption public key from Turnkey...");
  const { privateKey: encryptionKey } = await turnkeyClient
    .apiClient()
    .getPrivateKey({
      privateKeyId: encryptionKeyId,
    });

  const publicKey = encryptionKey.publicKey;

  console.log("Encrypting data...");
  const payload = JSON.stringify({ type: "custom", data });
  const encryptedData = await encryptWithPublicKey(publicKey, payload);

  // Load or create store
  const storePath = path.resolve(process.cwd(), "encrypted-wallet-store.json");
  let store: EncryptedStore;

  if (fs.existsSync(storePath)) {
    store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
  } else {
    store = {
      version: "1.0",
      encryptionKeyId,
      organizationId: organizationId!,
      bundles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  store.bundles.push({
    id: `custom-${Date.now()}`,
    name,
    encryptedData,
    createdAt: new Date().toISOString(),
  });
  store.updatedAt = new Date().toISOString();

  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

  console.log();
  console.log("═".repeat(60));
  console.log("SUCCESS: Data encrypted and stored locally!");
  console.log("═".repeat(60));
  console.log();
  console.log("Label:     ", name);
  console.log("Store:      encrypted-wallet-store.json");
  console.log("Total bundles:", store.bundles.length);
}

// ============================================================================
// Per-Session: Start Session
// ============================================================================

async function startSession(): Promise<void> {
  console.log("─".repeat(60));
  console.log("EXPORT KEY & DECRYPT DATA");
  console.log("─".repeat(60));
  console.log();
  console.log("This retrieves the decryption key from Turnkey and decrypts");
  console.log("your locally-stored encrypted bundles.");
  console.log();
  console.log("After this step, you can use the decrypted data locally");
  console.log("(sign transactions, access credentials, etc.) with NO further");
  console.log("Turnkey API calls required.");
  console.log();

  if (activeSession.decryptionKey) {
    console.log("Data already decrypted. Clear it first to start fresh.");
    return;
  }

  const encryptionKeyId = process.env.ENCRYPTION_KEY_ID;
  const organizationId = process.env.ORGANIZATION_ID;

  if (!encryptionKeyId) {
    throw new Error(
      "Missing ENCRYPTION_KEY_ID. Run 'Create Encryption Key' first."
    );
  }

  // Load encrypted store
  const storePath = path.resolve(process.cwd(), "encrypted-wallet-store.json");
  if (!fs.existsSync(storePath)) {
    throw new Error(
      "No encrypted wallet store found. Run 'Generate & Encrypt Wallets' first."
    );
  }

  const store: EncryptedStore = JSON.parse(fs.readFileSync(storePath, "utf-8"));
  console.log(`Found ${store.bundles.length} encrypted bundles.`);
  console.log();

  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: "Export decryption key from Turnkey and start session?",
    initial: true,
  });

  if (!confirm) return;

  const turnkeyClient = getTurnkeyClient();

  console.log();
  console.log("Step 1: Generate target keypair for key export...");
  const targetKeyPair = generateP256KeyPair();

  console.log("Step 2: Export decryption key from Turnkey...");
  const startExport = Date.now();

  const exportResult = await turnkeyClient.apiClient().exportPrivateKey({
    privateKeyId: encryptionKeyId,
    targetPublicKey: targetKeyPair.publicKeyUncompressed,
  });

  const exportTime = Date.now() - startExport;
  console.log(`  Key exported in ${exportTime}ms`);

  console.log("Step 3: Decrypt export bundle...");
  const decryptedKeyBundle = await decryptExportBundle({
    exportBundle: exportResult.exportBundle,
    embeddedKey: targetKeyPair.privateKey,
    organizationId: organizationId!,
    returnMnemonic: false,
  });

  const decryptionKey = decryptedKeyBundle;

  console.log("Step 4: Decrypt bundles...");
  const startDecrypt = Date.now();

  const decryptedWallets: DecryptedEntry[] = [];

  for (let i = 0; i < store.bundles.length; i++) {
    const bundle = store.bundles[i];
    const decryptedJson = await decryptWithPrivateKey(
      decryptionKey,
      bundle.encryptedData
    );
    const parsed = JSON.parse(decryptedJson);

    if (parsed.type === "custom") {
      decryptedWallets.push({
        id: bundle.id,
        name: bundle.name,
        data: parsed.data,
      });
    } else {
      decryptedWallets.push({
        id: bundle.id,
        name: bundle.name,
        privateKey: parsed.privateKey,
        address: bundle.address,
      });
    }

    process.stdout.write(
      `\r  Decrypted ${i + 1}/${store.bundles.length} bundles`
    );
  }
  console.log();

  const decryptTime = Date.now() - startDecrypt;

  // Store in session
  activeSession = {
    decryptionKey,
    decryptedWallets,
    startedAt: new Date(),
  };

  console.log();
  console.log("═".repeat(60));
  console.log("SUCCESS: Data decrypted and ready for use!");
  console.log("═".repeat(60));
  console.log();
  console.log("Performance:");
  console.log(`  Turnkey API call:  ${exportTime}ms (single request to export key)`);
  console.log(`  Local decryption:  ${decryptTime}ms (${store.bundles.length} bundles)`);
  console.log(`  Total:             ${exportTime + decryptTime}ms`);
  console.log();
  console.log(`${decryptedWallets.length} items now available in memory.`);
  console.log();
  console.log("From this point forward:");
  console.log("  • All operations are LOCAL (no Turnkey API calls)");
  console.log("  • Sign transactions, access data, etc. with zero latency");
  console.log("  • When done, clear sensitive data from memory");
}

// ============================================================================
// Per-Session: Sign Demo
// ============================================================================

async function signDemo(): Promise<void> {
  console.log("─".repeat(60));
  console.log("USE DECRYPTED DATA (DEMO)");
  console.log("─".repeat(60));
  console.log();
  console.log("This demonstrates using the decrypted wallet data to sign");
  console.log("a message. Note: NO Turnkey API calls are made here.");
  console.log();

  if (!activeSession.decryptionKey || activeSession.decryptedWallets.length === 0) {
    console.log("No decrypted data available. Export key & decrypt first.");
    return;
  }

  const wallets = activeSession.decryptedWallets.filter((e) => e.privateKey);
  const customEntries = activeSession.decryptedWallets.filter((e) => e.data);

  if (customEntries.length > 0) {
    console.log(`Custom data entries: ${customEntries.length}`);
    customEntries.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.name}: ${e.data}`);
    });
    console.log();
  }

  if (wallets.length === 0) {
    console.log("No wallet entries available to sign with.");
    return;
  }

  console.log(`Available wallets: ${wallets.length}`);
  console.log();

  const { walletIndex } = await prompts({
    type: "number",
    name: "walletIndex",
    message: `Select wallet index (0-${wallets.length - 1}):`,
    initial: 0,
    min: 0,
    max: wallets.length - 1,
  });

  if (walletIndex === undefined) return;

  const { message } = await prompts({
    type: "text",
    name: "message",
    message: "Message to sign:",
    initial: "Hello, Turnkey!",
  });

  if (!message) return;

  const wallet = wallets[walletIndex];
  const account = privateKeyToAccount(wallet.privateKey! as `0x${string}`);

  console.log();
  console.log("Signing message locally (zero network latency)...");

  const startSign = Date.now();
  const signature = await account.signMessage({ message });
  const signTime = Date.now() - startSign;

  console.log();
  console.log("═".repeat(60));
  console.log("SIGNATURE COMPLETE");
  console.log("═".repeat(60));
  console.log();
  console.log("Wallet:    ", wallet.name);
  console.log("Address:   ", wallet.address);
  console.log("Message:   ", message);
  console.log("Signature: ", signature.slice(0, 40) + "...");
  console.log("Time:      ", `${signTime}ms`);
  console.log();
  console.log("─".repeat(60));
  console.log("Key Insight:");
  console.log("─".repeat(60));
  console.log("  This signature was created entirely LOCAL.");
  console.log("  Zero Turnkey API calls. Zero network latency.");
  console.log("  Turnkey was only used to retrieve the decryption key.");
}

// ============================================================================
// Per-Session: End Session
// ============================================================================

function endSession(): void {
  console.log("─".repeat(60));
  console.log("CLEAR SENSITIVE DATA");
  console.log("─".repeat(60));
  console.log();

  if (!activeSession.decryptionKey) {
    console.log("No decrypted data to clear.");
    return;
  }

  const sessionDuration = activeSession.startedAt
    ? Math.round((Date.now() - activeSession.startedAt.getTime()) / 1000)
    : 0;

  console.log("Burning decryption key from memory...");

  // Attempt to securely wipe the decryption key
  if (activeSession.decryptionKey) {
    const keyBytes = hexToBytes(activeSession.decryptionKey);
    secureWipe(keyBytes);
  }

  // Wipe all decrypted private keys and data
  console.log("Wiping decrypted data from memory...");
  for (const entry of activeSession.decryptedWallets) {
    if (entry.privateKey) {
      const keyBytes = hexToBytes(entry.privateKey.slice(2));
      secureWipe(keyBytes);
    }
    if (entry.data) {
      secureWipe(entry.data);
    }
  }

  // Clear session state
  const walletCount = activeSession.decryptedWallets.length;
  activeSession = {
    decryptionKey: null,
    decryptedWallets: [],
    startedAt: null,
  };

  console.log();
  console.log("═".repeat(60));
  console.log("SENSITIVE DATA CLEARED");
  console.log("═".repeat(60));
  console.log();
  console.log("Duration:        ", `${sessionDuration} seconds`);
  console.log("Items cleared:   ", walletCount);
  console.log();
  console.log("─".repeat(60));
  console.log("Security Model Restored:");
  console.log("─".repeat(60));
  console.log("  ✓ Decryption key:   Cleared from memory");
  console.log("  ✓ Decrypted data:   Cleared from memory");
  console.log("  ✓ Encrypted store:  Still in YOUR infrastructure (safe)");
  console.log("  ✓ Turnkey enclave:  Still holds the encryption key");
  console.log();
  console.log("To access data again, authenticate to Turnkey and export the key.");
}

// ============================================================================
// View Encrypted Store
// ============================================================================

async function viewEncryptedStore(): Promise<void> {
  console.log("─".repeat(60));
  console.log("VIEW ENCRYPTED STORE");
  console.log("─".repeat(60));
  console.log();
  console.log("This shows the encrypted data stored in YOUR infrastructure.");
  console.log("Turnkey has NEVER seen this data - only the encryption key.");
  console.log();

  const storePath = path.resolve(process.cwd(), "encrypted-wallet-store.json");

  if (!fs.existsSync(storePath)) {
    console.log("No encrypted store found.");
    console.log("Run 'Generate & Encrypt Test Data' to create one.");
    return;
  }

  const store: EncryptedStore = JSON.parse(fs.readFileSync(storePath, "utf-8"));

  console.log("─".repeat(60));
  console.log("Store Details:");
  console.log("─".repeat(60));
  console.log("  Location:       ", "encrypted-wallet-store.json (YOUR infrastructure)");
  console.log("  Version:        ", store.version);
  console.log("  Encryption Key: ", store.encryptionKeyId.slice(0, 30) + "...");
  console.log("  Bundle count:   ", store.bundles.length);
  console.log("  Created:        ", store.createdAt);
  console.log();

  console.log("Encrypted bundles (metadata only - contents encrypted):");
  store.bundles.slice(0, 10).forEach((bundle, i) => {
    const detail = bundle.address ?? "(custom data)";
    console.log(`  ${i + 1}. ${bundle.name}: ${detail}`);
  });
  if (store.bundles.length > 10) {
    console.log(`  ... and ${store.bundles.length - 10} more`);
  }
  console.log();

  console.log("─".repeat(60));
  console.log("Security Status:");
  console.log("─".repeat(60));
  console.log("  ✓ Data encrypted with P-256 ECIES");
  console.log("  ✓ Decryption key held in Turnkey enclave");
  console.log("  ✓ Without Turnkey authentication, this data is useless");
}

// ============================================================================
// Main
// ============================================================================

mainMenu().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
