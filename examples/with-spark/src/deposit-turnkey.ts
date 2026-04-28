/**
 * Deposit: Turnkey Bitcoin regtest funding account -> Spark
 *
 * Spends UTXOs from a Turnkey-controlled bcrt1p... address into Spark's
 * single-use deposit address, broadcasts through Spark's hosted regtest
 * Electrs endpoint, and claims the deposit into the Turnkey Spark wallet.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, TURNKEY_ECDSA_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *   TURNKEY_L1_BTC_ADDRESS, TURNKEY_L1_BTC_PUBLIC_KEY_HEX
 *
 * Optional:
 *   L1_DEPOSIT_TXID – skips funding spend and claims an already-broadcast tx
 *   L1_DEPOSIT_AMOUNT_SATS – default spends all available funding UTXOs minus fee
 *   L1_DEPOSIT_FEE_SATS – default 500
 *   L1_FUNDING_TIMEOUT_MS – default 60000
 *   L1_FUNDING_POLL_MS – default 5000
 *   L1_DEPOSIT_CONFIRMATION_TIMEOUT_MS – default 300000
 *   L1_DEPOSIT_CONFIRMATION_POLL_MS – default 5000
 *   SPARK_REGTEST_ELECTRS_URL
 */

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { env, initSparkWallet, requireEnv } from "./init";
import {
  DEFAULT_SPARK_REGTEST_ELECTRS_URL,
  depositTurnkeyL1ToSpark,
} from "./turnkeyL1Deposit";

function optionalBigIntEnv(name: string): bigint | undefined {
  const value = process.env[name];
  return value ? BigInt(value) : undefined;
}

async function main() {
  const network = env("SPARK_NETWORK", "REGTEST");
  if (network !== "REGTEST") {
    throw new Error("This deposit flow only supports SPARK_NETWORK=REGTEST");
  }

  const { wallet } = await initSparkWallet();
  console.log("Authenticated to Spark SO");

  try {
    const turnkeyClient = new TurnkeyServerSDK({
      apiBaseUrl: env("BASE_URL", "https://api.turnkey.com"),
      apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
      apiPublicKey: requireEnv("API_PUBLIC_KEY"),
      defaultOrganizationId: requireEnv("ORGANIZATION_ID"),
    });

    const result = await depositTurnkeyL1ToSpark({
      wallet,
      turnkeyClient,
      fundingAddress: requireEnv("TURNKEY_L1_BTC_ADDRESS"),
      fundingPublicKeyHex: requireEnv("TURNKEY_L1_BTC_PUBLIC_KEY_HEX"),
      existingTxid: process.env.L1_DEPOSIT_TXID,
      amountSats: optionalBigIntEnv("L1_DEPOSIT_AMOUNT_SATS"),
      feeSats: BigInt(env("L1_DEPOSIT_FEE_SATS", "500")),
      electrsUrl: env("SPARK_REGTEST_ELECTRS_URL", DEFAULT_SPARK_REGTEST_ELECTRS_URL),
      fundingTimeoutMs: Number(env("L1_FUNDING_TIMEOUT_MS", "60000")),
      fundingPollMs: Number(env("L1_FUNDING_POLL_MS", "5000")),
      confirmationTimeoutMs: Number(env("L1_DEPOSIT_CONFIRMATION_TIMEOUT_MS", "300000")),
      confirmationPollMs: Number(env("L1_DEPOSIT_CONFIRMATION_POLL_MS", "5000")),
      log: console.log,
    });

    console.log(`L1 deposit confirmed in block ${result.status.block_height ?? "unknown"}`);
    console.log("Claimed deposit into Spark");
    console.log(`Balance: ${result.balanceSats} sats available`);
    console.log("\nDone.");
  } finally {
    wallet.cleanupConnections();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
