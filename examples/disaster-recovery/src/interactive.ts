#!/usr/bin/env node
/**
 * Disaster Recovery Interactive CLI
 *
 * A unified interface for all disaster recovery operations:
 * - Generate test wallets (for testing/PoC)
 * - Path 1: Direct Wallet Import
 * - Path 2: Encryption Key Escrow
 *
 * Usage: pnpm start
 */

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import prompts from "prompts";
import { Turnkey } from "@turnkey/sdk-server";
import { Crypto } from "@peculiar/webcrypto";
import {
  encryptWalletToBundle,
  encryptPrivateKeyToBundle,
  generateP256KeyPair,
  decryptExportBundle,
} from "@turnkey/crypto";
import { createAccount } from "@turnkey/viem";
import * as viem from "viem";
import { sepolia, mainnet } from "viem/chains";
import {
  generateMnemonic,
  mnemonicToAccount,
  privateKeyToAccount,
  english,
} from "viem/accounts";
import {
  encryptWithPublicKey,
  decryptWithPrivateKey,
} from "./shared/crypto-helpers";

const { createWalletClient, createPublicClient, http, formatEther } = viem;

// Polyfill crypto for Node.js
if (typeof crypto === "undefined") {
  (global as any).crypto = new Crypto();
}

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Network configurations for sweeping
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

// Key type configurations for private key import
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

async function mainMenu(): Promise<void> {
  console.clear();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         TURNKEY DISASTER RECOVERY TOOLKIT                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();

  while (true) {
    const { action } = await prompts({
      type: "select",
      name: "action",
      message: "What would you like to do?",
      choices: [
        {
          title: "Generate Test Wallet",
          description: "Create a test mnemonic or private key for testing",
          value: "generate",
        },
        {
          title: "─── Path 1: Direct Wallet Import ───",
          value: "separator1",
          disabled: true,
        },
        {
          title: "Import HD Wallet (Mnemonic)",
          description: "Import a BIP-39 seed phrase into Turnkey",
          value: "import-wallet",
        },
        {
          title: "Import Private Key",
          description: "Import a raw private key (ETH/SOL/BTC)",
          value: "import-key",
        },
        {
          title: "Sweep Funds",
          description: "Move funds to a safe treasury address",
          value: "sweep",
        },
        {
          title: "─── Path 2: Encryption Key Escrow ───",
          value: "separator2",
          disabled: true,
        },
        {
          title: "Setup Encryption Escrow",
          description: "Create encryption key and encrypt recovery bundle",
          value: "escrow-setup",
        },
        {
          title: "Recovery from Escrow",
          description: "Export key and decrypt recovery bundle",
          value: "escrow-recovery",
        },
        {
          title: "───────────────────────────────────",
          value: "separator3",
          disabled: true,
        },
        { title: "Exit", value: "exit" },
      ],
    });

    if (!action || action === "exit") {
      console.log("Goodbye!");
      return;
    }

    console.log();

    try {
      switch (action) {
        case "generate":
          await generateTestWallet();
          break;
        case "import-wallet":
          await importHDWallet();
          break;
        case "import-key":
          await importPrivateKey();
          break;
        case "sweep":
          await sweepFunds();
          break;
        case "escrow-setup":
          await escrowSetup();
          break;
        case "escrow-recovery":
          await escrowRecovery();
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
    console.log("║         TURNKEY DISASTER RECOVERY TOOLKIT                  ║");
    console.log("╚════════════════════════════════════════════════════════════╝");
    console.log();
  }
}

// ============================================================================
// Generate Test Wallet
// ============================================================================

async function generateTestWallet(): Promise<void> {
  console.log("─".repeat(60));
  console.log("GENERATE TEST WALLET");
  console.log("─".repeat(60));
  console.log();
  console.log("WARNING: These wallets are for TESTING ONLY!");
  console.log("Do not use for real funds in production.");
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

  if (!walletType) return;

  const results: any = {};

  if (walletType === "mnemonic" || walletType === "both") {
    results.mnemonic = await generateMnemonicWallet();
  }

  if (walletType === "privatekey" || walletType === "both") {
    results.privateKey = await generatePrivateKeyWallet();
  }

  // Offer to save to file
  const { saveToFile } = await prompts({
    type: "confirm",
    name: "saveToFile",
    message: "Save to file for easy reference?",
    initial: true,
  });

  if (saveToFile) {
    const timestamp = Date.now();
    const filesToSave: Array<{ filename: string; content: object }> = [];

    if (results.mnemonic && results.privateKey) {
      // Both - save to separate files for clarity
      filesToSave.push({
        filename: `test-hd-wallet-${timestamp}.json`,
        content: {
          type: "hd-wallet",
          warning: "TEST WALLET ONLY - DO NOT USE FOR REAL FUNDS",
          createdAt: new Date().toISOString(),
          ...results.mnemonic,
        },
      });
      filesToSave.push({
        filename: `test-private-key-${timestamp}.json`,
        content: {
          type: "private-key",
          warning: "TEST WALLET ONLY - DO NOT USE FOR REAL FUNDS",
          createdAt: new Date().toISOString(),
          ...results.privateKey,
        },
      });
    } else if (results.mnemonic) {
      filesToSave.push({
        filename: `test-hd-wallet-${timestamp}.json`,
        content: {
          type: "hd-wallet",
          warning: "TEST WALLET ONLY - DO NOT USE FOR REAL FUNDS",
          createdAt: new Date().toISOString(),
          ...results.mnemonic,
        },
      });
    } else if (results.privateKey) {
      filesToSave.push({
        filename: `test-private-key-${timestamp}.json`,
        content: {
          type: "private-key",
          warning: "TEST WALLET ONLY - DO NOT USE FOR REAL FUNDS",
          createdAt: new Date().toISOString(),
          ...results.privateKey,
        },
      });
    }

    console.log();
    for (const { filename, content } of filesToSave) {
      const filepath = path.resolve(process.cwd(), filename);
      fs.writeFileSync(filepath, JSON.stringify(content, null, 2));
      console.log(`Saved to ${filename}`);
    }
  }

  // Show next steps
  console.log();
  console.log("─".repeat(60));
  console.log("NEXT STEPS:");
  console.log("─".repeat(60));
  console.log();

  if (results.mnemonic) {
    console.log("To import the HD wallet:");
    console.log('  Select "Import HD Wallet" from the main menu');
    console.log("  Enter the mnemonic when prompted");
    console.log();
  }

  if (results.privateKey) {
    console.log("To import the private key:");
    console.log('  Select "Import Private Key" from the main menu');
    console.log('  Select "Ethereum/EVM"');
    console.log("  Enter the private key when prompted");
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
  console.log('  3. After importing, select "Sweep Funds" from the menu');
}

async function generateMnemonicWallet(): Promise<{
  mnemonic: string;
  wordCount: number;
  address: string;
  derivationPath: string;
}> {
  const { wordCount } = await prompts({
    type: "select",
    name: "wordCount",
    message: "Mnemonic length:",
    choices: [
      { title: "12 words (standard)", value: 12 },
      { title: "24 words (more secure)", value: 24 },
    ],
  });

  const strength = wordCount === 24 ? 256 : 128;
  const mnemonic = generateMnemonic(english, strength);
  const account = mnemonicToAccount(mnemonic);

  console.log();
  console.log("─".repeat(60));
  console.log("HD WALLET (MNEMONIC)");
  console.log("─".repeat(60));
  console.log();
  console.log("Mnemonic Seed Phrase:");
  console.log();

  const words = mnemonic.split(" ");
  const columns = wordCount === 24 ? 4 : 3;
  for (let i = 0; i < words.length; i += columns) {
    const row = words
      .slice(i, i + columns)
      .map(
        (word, idx) => `${String(i + idx + 1).padStart(2)}. ${word.padEnd(10)}`
      )
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

async function generatePrivateKeyWallet(): Promise<{
  privateKey: string;
  address: string;
  curve: string;
}> {
  const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const privateKeyHex =
    "0x" +
    Array.from(privateKeyBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

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

// ============================================================================
// Path 1: Import HD Wallet
// ============================================================================

async function importHDWallet(): Promise<void> {
  console.log("─".repeat(60));
  console.log("PATH 1: IMPORT HD WALLET (MNEMONIC)");
  console.log("─".repeat(60));
  console.log();

  const organizationId = process.env.ORGANIZATION_ID;
  const userId = process.env.USER_ID;

  if (!organizationId || !userId) {
    throw new Error(
      "Missing required environment variables: ORGANIZATION_ID, USER_ID"
    );
  }

  const turnkeyClient = getTurnkeyClient();

  console.log("Step 1: Initialize import bundle from Turnkey");
  console.log(
    "This creates a temporary public key in Turnkey's enclave for encrypting your mnemonic."
  );
  console.log();

  const initResult = await turnkeyClient.apiClient().initImportWallet({
    userId,
  });

  console.log("Import bundle received from Turnkey enclave.");
  console.log();

  console.log("Step 2: Encrypt wallet material");
  console.log(
    "SECURITY WARNING: In production, perform this step on an air-gapped machine!"
  );
  console.log();

  // Check for existing test wallet files
  const existingWalletFiles = fs
    .readdirSync(process.cwd())
    .filter((f) => f.startsWith("test-hd-wallet-") && f.endsWith(".json"));

  let mnemonic: string;

  if (existingWalletFiles.length > 0) {
    const { inputMethod } = await prompts({
      type: "select",
      name: "inputMethod",
      message: "How would you like to provide the mnemonic?",
      choices: [
        { title: "Enter manually", value: "manual" },
        { title: "Load from file", value: "file" },
      ],
    });

    if (!inputMethod) return;

    if (inputMethod === "file") {
      const { selectedFile } = await prompts({
        type: "select",
        name: "selectedFile",
        message: "Select a wallet file:",
        choices: existingWalletFiles.map((f) => ({ title: f, value: f })),
      });

      if (!selectedFile) return;

      const filePath = path.resolve(process.cwd(), selectedFile);
      const fileContents = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      if (!fileContents.mnemonic) {
        throw new Error("Selected file does not contain a mnemonic");
      }

      mnemonic = fileContents.mnemonic;
      console.log();
      console.log(`Loaded mnemonic from ${selectedFile}`);
      console.log(`Address: ${fileContents.address}`);
    } else {
      const { mnemonicInput } = await prompts({
        type: "password",
        name: "mnemonicInput",
        message: "Enter your BIP-39 mnemonic seed phrase:",
        validate: (value) => {
          const words = value.trim().split(/\s+/);
          if (words.length !== 12 && words.length !== 24) {
            return "Mnemonic must be 12 or 24 words";
          }
          return true;
        },
      });

      if (!mnemonicInput) return;
      mnemonic = mnemonicInput;
    }
  } else {
    const { mnemonicInput } = await prompts({
      type: "password",
      name: "mnemonicInput",
      message: "Enter your BIP-39 mnemonic seed phrase:",
      validate: (value) => {
        const words = value.trim().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) {
          return "Mnemonic must be 12 or 24 words";
        }
        return true;
      },
    });

    if (!mnemonicInput) return;
    mnemonic = mnemonicInput;
  }

  const { walletName } = await prompts({
    type: "text",
    name: "walletName",
    message: "Enter a name for this DR wallet:",
    initial: `DR-Wallet-${Date.now()}`,
  });

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

  console.log("Step 3: Import encrypted wallet to Turnkey");

  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: `Import wallet "${walletName}" to Turnkey?`,
    initial: true,
  });

  if (!confirm) return;

  const importResult = await turnkeyClient.apiClient().importWallet({
    userId,
    walletName,
    encryptedBundle,
    accounts: [],
  });

  console.log();
  console.log("═".repeat(60));
  console.log("SUCCESS: Wallet imported!");
  console.log("═".repeat(60));
  console.log();
  console.log("Wallet ID:", importResult.walletId);
  console.log();
  console.log("Next steps:");
  console.log("1. Create wallet accounts for the chains you need");
  console.log("2. Configure quorum policies for DR access");
  console.log('3. Test fund sweeping with "Sweep Funds" option');
}

// ============================================================================
// Path 1: Import Private Key
// ============================================================================

async function importPrivateKey(): Promise<void> {
  console.log("─".repeat(60));
  console.log("PATH 1: IMPORT RAW PRIVATE KEY");
  console.log("─".repeat(60));
  console.log();

  const organizationId = process.env.ORGANIZATION_ID;
  const userId = process.env.USER_ID;

  if (!organizationId || !userId) {
    throw new Error(
      "Missing required environment variables: ORGANIZATION_ID, USER_ID"
    );
  }

  const turnkeyClient = getTurnkeyClient();

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

  if (!keyType) return;

  const keyConfig = KEY_TYPES[keyType as keyof typeof KEY_TYPES];

  console.log();
  console.log("Step 1: Initialize import bundle from Turnkey");

  const initResult = await turnkeyClient.apiClient().initImportPrivateKey({
    userId,
  });

  console.log("Import bundle received from Turnkey enclave.");
  console.log();

  console.log("Step 2: Encrypt private key material");
  console.log(
    "SECURITY WARNING: In production, perform this step on an air-gapped machine!"
  );
  console.log();

  // Check for existing test private key files
  const existingKeyFiles = fs
    .readdirSync(process.cwd())
    .filter((f) => f.startsWith("test-private-key-") && f.endsWith(".json"));

  let privateKey: string;

  if (existingKeyFiles.length > 0) {
    const { inputMethod } = await prompts({
      type: "select",
      name: "inputMethod",
      message: "How would you like to provide the private key?",
      choices: [
        { title: "Enter manually", value: "manual" },
        { title: "Load from file", value: "file" },
      ],
    });

    if (!inputMethod) return;

    if (inputMethod === "file") {
      const { selectedFile } = await prompts({
        type: "select",
        name: "selectedFile",
        message: "Select a private key file:",
        choices: existingKeyFiles.map((f) => ({ title: f, value: f })),
      });

      if (!selectedFile) return;

      const filePath = path.resolve(process.cwd(), selectedFile);
      const fileContents = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      if (!fileContents.privateKey) {
        throw new Error("Selected file does not contain a private key");
      }

      privateKey = fileContents.privateKey;
      console.log();
      console.log(`Loaded private key from ${selectedFile}`);
      console.log(`Address: ${fileContents.address}`);
    } else {
      const { privateKeyInput } = await prompts({
        type: "password",
        name: "privateKeyInput",
        message: `Enter your ${keyConfig.label} private key:`,
        validate: (value) => {
          if (!value || value.trim().length === 0) {
            return "Private key is required";
          }
          return true;
        },
      });

      if (!privateKeyInput) return;
      privateKey = privateKeyInput;
    }
  } else {
    const { privateKeyInput } = await prompts({
      type: "password",
      name: "privateKeyInput",
      message: `Enter your ${keyConfig.label} private key:`,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Private key is required";
        }
        return true;
      },
    });

    if (!privateKeyInput) return;
    privateKey = privateKeyInput;
  }

  const { keyName } = await prompts({
    type: "text",
    name: "keyName",
    message: "Enter a name for this DR key:",
    initial: `DR-Key-${keyType.toUpperCase()}-${Date.now()}`,
  });

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

  console.log("Step 3: Import encrypted key to Turnkey");

  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: `Import key "${keyName}" to Turnkey?`,
    initial: true,
  });

  if (!confirm) return;

  const importResult = await turnkeyClient.apiClient().importPrivateKey({
    userId,
    privateKeyName: keyName,
    encryptedBundle,
    curve: keyConfig.curve,
    addressFormats: [...keyConfig.addressFormats],
  });

  console.log();
  console.log("═".repeat(60));
  console.log("SUCCESS: Private key imported!");
  console.log("═".repeat(60));
  console.log();
  console.log("Private Key ID:", importResult.privateKeyId);
  console.log("Addresses:", importResult.addresses);
  console.log();
  console.log("Next steps:");
  console.log("1. Update SIGN_WITH in .env.local with the address above");
  console.log('2. Test fund sweeping with "Sweep Funds" option');
}

// ============================================================================
// Path 1: Sweep Funds
// ============================================================================

async function sweepFunds(): Promise<void> {
  console.log("─".repeat(60));
  console.log("PATH 1: SWEEP FUNDS");
  console.log("─".repeat(60));
  console.log();

  const organizationId = process.env.ORGANIZATION_ID;
  const signWith = process.env.SIGN_WITH;
  const safeTreasury = process.env.SAFE_TREASURY_ADDRESS;

  if (!organizationId) {
    throw new Error("Missing required environment variable: ORGANIZATION_ID");
  }

  if (!signWith) {
    throw new Error(
      "Missing SIGN_WITH - set this to the imported wallet/key address in .env.local"
    );
  }

  if (!safeTreasury) {
    throw new Error(
      "Missing SAFE_TREASURY_ADDRESS - set this to your safe destination address in .env.local"
    );
  }

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

  if (!network) return;

  const networkConfig = NETWORKS[network as keyof typeof NETWORKS];
  const turnkeyClient = getTurnkeyClient();

  const publicClient = createPublicClient({
    chain: networkConfig.chain,
    transport: http(networkConfig.rpcUrl),
  });

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

  console.log("Fetching wallet balance...");
  const balance = await publicClient.getBalance({
    address: signWith as `0x${string}`,
  });

  console.log();
  console.log("─".repeat(40));
  console.log("Wallet Information");
  console.log("─".repeat(40));
  console.log("Network:     ", network);
  console.log("Address:     ", signWith);
  console.log("Balance:     ", formatEther(balance), "ETH");
  console.log("Destination: ", safeTreasury);
  console.log("─".repeat(40));
  console.log();

  if (balance === 0n) {
    console.log("No ETH to sweep. Wallet is empty.");
    return;
  }

  const gasPrice = await publicClient.getGasPrice();
  const gasLimit = 21000n;
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

  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: `Sweep ${formatEther(sweepAmount)} ETH to ${safeTreasury}?`,
    initial: false,
  });

  if (!confirm) return;

  if (network === "mainnet") {
    const { doubleConfirm } = await prompts({
      type: "text",
      name: "doubleConfirm",
      message:
        'MAINNET TRANSACTION: Type "SWEEP" to confirm (this will move real funds):',
    });

    if (doubleConfirm !== "SWEEP") return;
  }

  console.log();
  console.log("Executing sweep transaction...");

  const txHash = await walletClient.sendTransaction({
    to: safeTreasury as `0x${string}`,
    value: sweepAmount,
  });

  console.log();
  console.log("═".repeat(60));
  console.log("SUCCESS: Sweep transaction submitted!");
  console.log("═".repeat(60));
  console.log();
  console.log("Transaction Hash:", txHash);
  console.log("Explorer URL:    ", `${networkConfig.explorerUrl}/tx/${txHash}`);
  console.log();

  console.log("Waiting for transaction confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === "success") {
    console.log();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());

    const newBalance = await publicClient.getBalance({
      address: signWith as `0x${string}`,
    });
    console.log("Remaining balance:", formatEther(newBalance), "ETH");
  } else {
    console.error("Transaction failed!");
  }
}

// ============================================================================
// Path 2: Escrow Setup
// ============================================================================

interface RecoveryBundle {
  version: string;
  createdAt: string;
  type: "wallet" | "credentials" | "custom";
  data: {
    mnemonic?: string;
    privateKeys?: Array<{ name: string; key: string; chain: string }>;
    credentials?: Array<{ service: string; apiKey: string }>;
    custom?: string;
  };
  metadata?: { description?: string; organization?: string };
}

async function escrowSetup(): Promise<void> {
  console.log("─".repeat(60));
  console.log("PATH 2: ENCRYPTION KEY ESCROW - SETUP");
  console.log("─".repeat(60));
  console.log();
  console.log("This will:");
  console.log("1. Create an encryption keypair in Turnkey");
  console.log("2. Encrypt your recovery material with Turnkey's public key");
  console.log("3. Save the encrypted bundle locally (you store this securely)");
  console.log();
  console.log("Note: The encrypted bundle should be stored in YOUR infrastructure,");
  console.log("not on Turnkey. This creates a 2-of-2 security model.");
  console.log();

  const organizationId = process.env.ORGANIZATION_ID;
  if (!organizationId) {
    throw new Error("Missing required environment variable: ORGANIZATION_ID");
  }

  const turnkeyClient = getTurnkeyClient();
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
  console.log("─".repeat(40));
  console.log("Encryption Key Details");
  console.log("─".repeat(40));
  console.log("Private Key ID:", privateKeyId);
  console.log("Public Key:    ", publicKey.substring(0, 40) + "...");
  console.log("─".repeat(40));
  console.log();

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

  if (!bundleType) return;

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

    if (!mnemonic) return;
    recoveryBundle.data.mnemonic = mnemonic.trim();
  } else if (bundleType === "credentials") {
    const credentials: Array<{ service: string; apiKey: string }> = [];

    let addMore = true;
    while (addMore) {
      const { service, apiKey } = await prompts([
        { type: "text", name: "service", message: "Service name (e.g., AWS, Alchemy):" },
        { type: "password", name: "apiKey", message: "API Key/Secret:" },
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

  const { addMetadata } = await prompts({
    type: "confirm",
    name: "addMetadata",
    message: "Add description/metadata to the bundle?",
    initial: false,
  });

  if (addMetadata) {
    const { description, organization } = await prompts([
      { type: "text", name: "description", message: "Description:" },
      { type: "text", name: "organization", message: "Organization name:" },
    ]);

    recoveryBundle.metadata = { description, organization };
  }

  console.log();
  console.log("Encrypting recovery bundle...");

  const bundleJson = JSON.stringify(recoveryBundle);
  const encryptedBundle = await encryptWithPublicKey(publicKey, bundleJson);

  console.log("Bundle encrypted successfully.");
  console.log();

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
  console.log("═".repeat(60));
  console.log("SUCCESS: Encryption Key Escrow Setup Complete!");
  console.log("═".repeat(60));
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
}

async function createNewEncryptionKey(
  turnkeyClient: Turnkey
): Promise<{ privateKeyId: string; publicKey: string }> {
  console.log();
  console.log("Step 1: Create encryption keypair in Turnkey");

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
        addressFormats: [],
        privateKeyTags: [],
      },
    ],
  });

  const privateKeyId = privateKeys[0].privateKeyId;

  const { privateKey } = await turnkeyClient.apiClient().getPrivateKey({
    privateKeyId,
  });

  console.log("Encryption keypair created successfully.");

  return { privateKeyId, publicKey: privateKey.publicKey };
}

// ============================================================================
// Path 2: Escrow Recovery
// ============================================================================

interface StoredBundle {
  version: string;
  encryptionKeyId: string;
  organizationId: string;
  encryptedData: string;
  createdAt: string;
}

async function escrowRecovery(): Promise<void> {
  console.log("─".repeat(60));
  console.log("PATH 2: ENCRYPTION KEY ESCROW - RECOVERY");
  console.log("─".repeat(60));
  console.log();
  console.log("This will:");
  console.log("1. Export the encryption key from Turnkey");
  console.log("2. Load your encrypted recovery bundle");
  console.log("3. Decrypt and display the recovery material");
  console.log();
  console.log("WARNING: The decrypted material will be displayed on screen.");
  console.log("Ensure you are in a secure environment.");
  console.log();

  const organizationId = process.env.ORGANIZATION_ID;
  const encryptionKeyId = process.env.ENCRYPTION_KEY_ID;

  if (!organizationId) {
    throw new Error("Missing required environment variable: ORGANIZATION_ID");
  }

  const turnkeyClient = getTurnkeyClient();

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

  if (!bundlePath) return;

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

  const keyIdToUse = storedBundle.encryptionKeyId || encryptionKeyId;

  if (!keyIdToUse) {
    throw new Error(
      "No encryption key ID found in bundle or ENCRYPTION_KEY_ID environment variable"
    );
  }

  const { confirmExport } = await prompts({
    type: "confirm",
    name: "confirmExport",
    message: `Export encryption key (${keyIdToUse}) from Turnkey?`,
    initial: false,
  });

  if (!confirmExport) return;

  console.log();
  console.log("Step 1: Generate target keypair for export");

  const targetKeyPair = generateP256KeyPair();
  console.log("Target keypair generated.");
  console.log();

  console.log("Step 2: Export encryption key from Turnkey");
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

    const decryptedKeyBundle = await decryptExportBundle({
      exportBundle: exportResult.exportBundle,
      embeddedKey: targetKeyPair.privateKey,
      organizationId: storedBundle.organizationId || organizationId,
      returnMnemonic: false,
    });

    console.log("Export bundle decrypted.");
    console.log();

    console.log("Step 4: Decrypt recovery bundle");

    const encryptionPrivateKey =
      typeof decryptedKeyBundle === "string"
        ? decryptedKeyBundle
        : decryptedKeyBundle.privateKey;

    const decryptedRecoveryJson = await decryptWithPrivateKey(
      encryptionPrivateKey,
      storedBundle.encryptedData
    );

    const recoveryBundle: RecoveryBundle = JSON.parse(decryptedRecoveryJson);

    console.log();
    console.log("═".repeat(60));
    console.log("RECOVERY SUCCESSFUL");
    console.log("═".repeat(60));
    console.log();

    console.log("WARNING: Sensitive data displayed below. Clear your terminal after use.");
    console.log();

    const { showData } = await prompts({
      type: "confirm",
      name: "showData",
      message: "Display decrypted recovery data?",
      initial: false,
    });

    if (showData) {
      console.log("─".repeat(40));
      console.log("Recovery Bundle Details");
      console.log("─".repeat(40));
      console.log("Type:       ", recoveryBundle.type);
      console.log("Created at: ", recoveryBundle.createdAt);

      if (recoveryBundle.metadata) {
        console.log("Description:", recoveryBundle.metadata.description || "N/A");
        console.log("Organization:", recoveryBundle.metadata.organization || "N/A");
      }

      console.log();
      console.log("─".repeat(40));
      console.log("Recovered Data");
      console.log("─".repeat(40));

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

      console.log("─".repeat(40));
    }

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
      fs.writeFileSync(resolvedOutput, JSON.stringify(recoveryBundle, null, 2));
      console.log();
      console.log("Decrypted bundle saved to:", resolvedOutput);
      console.log("SECURITY: Delete this file after use!");
    }

    console.log();
    console.log("═".repeat(60));
    console.log("Recovery process complete.");
    console.log("Remember to clear your terminal and any saved files.");
    console.log("═".repeat(60));
  } catch (error: any) {
    if (error.message?.includes("consensus")) {
      console.log();
      console.log("═".repeat(60));
      console.log("QUORUM APPROVAL REQUIRED");
      console.log("═".repeat(60));
      console.log();
      console.log("This export requires additional approvals based on your policy.");
      console.log("Please coordinate with other key holders to complete the export.");
      console.log();
    } else {
      throw error;
    }
  }
}

// ============================================================================
// Main
// ============================================================================

mainMenu().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
