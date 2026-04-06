/**
 * Demonstrates authenticating to a Spark signing operator using Turnkey
 * as the key custodian.
 *
 * The authentication handshake:
 *   1. Spark SO issues a challenge (protobuf, SHA-256 hashed by the SDK)
 *   2. SDK calls signMessageWithIdentityKey(hash) → ECDSA, DER-encoded
 *   3. Spark SO verifies and returns a session token
 *
 * On success, wallet.getBalance() works — proving the SO accepted our
 * Turnkey-backed identity key.
 *
 * Required env vars (in .env.local):
 *   BASE_URL                  – Turnkey API base (http://localhost:5022 for local)
 *   API_PUBLIC_KEY
 *   API_PRIVATE_KEY
 *   ORGANIZATION_ID
 *   TURNKEY_IDENTITY_ADDRESS  – Turnkey key ID holding the Spark identity key
 *   IDENTITY_PUBLIC_KEY_HEX   – compressed 33-byte public key (hex) of that key
 *   SPARK_NETWORK             – REGTEST (default) or MAINNET
 */

import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { SparkWallet, WalletConfig } from "@buildonspark/spark-sdk";
import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { TurnkeySparkSigner } from "./turnkeySigner";

type SparkNetwork = "MAINNET" | "REGTEST";

async function main() {
  const network = (process.env.SPARK_NETWORK ?? "REGTEST") as SparkNetwork;

  const requiredVars = [
    "API_PUBLIC_KEY",
    "API_PRIVATE_KEY",
    "ORGANIZATION_ID",
    "TURNKEY_IDENTITY_ADDRESS",
    "IDENTITY_PUBLIC_KEY_HEX",
  ] as const;

  for (const v of requiredVars) {
    if (!process.env[v]) {
      throw new Error(`Missing required env var: ${v}`);
    }
  }

  const client = new TurnkeyServerSDK({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  const signer = new TurnkeySparkSigner(
    client,
    process.env.TURNKEY_IDENTITY_ADDRESS!,
    process.env.IDENTITY_PUBLIC_KEY_HEX!
  );

  const identityPubKey = await signer.getIdentityPublicKey();
  console.log(`\nIdentity public key: ${Buffer.from(identityPubKey).toString("hex")}`);
  console.log(`Network:             ${network}`);
  console.log(`\nInitializing SparkWallet with Turnkey signer...`);

  const walletOptions =
    network === "MAINNET" ? WalletConfig.MAINNET : WalletConfig.REGTEST;

  let mnemonic = process.env.MNEMONIC?.trim()!;

  // Pass the TurnkeySparkSigner directly — SparkWallet will use it for auth
  const { wallet } = await SparkWallet.initialize({
    signer,
    options: walletOptions,
    mnemonicOrSeed: mnemonic,
  });

  console.log(`✅ Authenticated to Spark SO successfully`);

  const sparkAddress = await wallet.getSparkAddress();
  const { balance } = await wallet.getBalance();

  console.log(`\nSpark address: ${sparkAddress}`);
  console.log(`Balance:       ${balance.toLocaleString()} sats`);

  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
