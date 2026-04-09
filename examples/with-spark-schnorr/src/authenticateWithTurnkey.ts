/**
 * Authenticates to a Spark signing operator using Turnkey as the key
 * custodian, then sends a Spark transfer.
 *
 * The authentication handshake:
 *   1. Spark SO issues a challenge (protobuf, SHA-256 hashed by the SDK)
 *   2. SDK calls signMessageWithIdentityKey(hash) → 64-byte Schnorr compact
 *   3. Spark SO verifies and returns a session token
 *
 * Required env vars (in .env.local):
 *   BASE_URL                  – Turnkey API base (http://localhost:5022 for local)
 *   API_PUBLIC_KEY
 *   API_PRIVATE_KEY
 *   ORGANIZATION_ID
 *   TURNKEY_IDENTITY_ADDRESS  – Turnkey key ID holding the Spark identity key
 *   IDENTITY_PUBLIC_KEY_HEX   – compressed 33-byte public key (hex) of that key
 *   SPARK_NETWORK             – REGTEST (default) or MAINNET
 *   MNEMONIC                  – BIP-39 mnemonic to restore wallet state
 *
 * Optional (for the transfer):
 *   RECEIVER_SPARK_ADDRESS    – Spark address to send to
 *   TRANSFER_AMOUNT_SATS      – Amount to send (default: 1000)
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
  console.log(
    `\nIdentity public key: ${Buffer.from(identityPubKey).toString("hex")}`
  );
  console.log(`Network:             ${network}`);
  console.log(`\nInitializing SparkWallet with Turnkey signer...`);

  const walletOptions = {
    ...(network === "MAINNET" ? WalletConfig.MAINNET : WalletConfig.REGTEST),
    // Skip seed derivation — keys live in Turnkey, not locally
    signerWithPreExistingKeys: true,
  };

  const { wallet } = await SparkWallet.initialize({
    signer,
    options: walletOptions,
  });

  wallet.claimDeposit

  console.log(`✅ Authenticated to Spark SO successfully`);

  const sparkAddress = await wallet.getSparkAddress();
  const { balance } = await wallet.getBalance();

  console.log(`\nSpark address: ${sparkAddress}`);
  console.log(`Balance:       ${balance.toLocaleString()} sats`);

  // const receiver = process.env.RECEIVER_SPARK_ADDRESS?.trim();
  // if (!receiver) {
  //   console.log(
  //     "\nSet RECEIVER_SPARK_ADDRESS to send a transfer. Skipping."
  //   );
  //   wallet.cleanupConnections();
  //   return;
  // }

  // const amountSats = parseInt(process.env.TRANSFER_AMOUNT_SATS ?? "1000", 10);

  // if (balance < amountSats) {
  //   console.log(
  //     `\nInsufficient balance (${balance} sats) to send ${amountSats} sats. Skipping transfer.`
  //   );
  //   wallet.cleanupConnections();
  //   return;
  // }

  // console.log(`\nSending ${amountSats} sats to ${receiver} ...`);
  // const transfer = await wallet.transfer({
  //   receiverSparkAddress: receiver,
  //   amountSats,
  // });

  // console.log(`✅ Transfer complete`);
  // console.log(`   Transfer ID: ${transfer.id}`);
  // console.log(`   Status:      ${transfer.status}`);
  // console.log(`   Amount:      ${transfer.totalValue?.toLocaleString()} sats`);

  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
