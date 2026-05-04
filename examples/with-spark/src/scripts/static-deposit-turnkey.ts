/**
 * Static deposit: Turnkey Bitcoin regtest funding account -> Spark static address.
 *
 * This is an export-based compatibility flow for the current Spark SDK/SSP
 * static-deposit API. The SDK claim path requires the raw static-deposit
 * private key, so this script creates/reuses the Turnkey wallet account at the
 * Spark static deposit path, then exports and installs the key just-in-time for
 * the claim.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, TURNKEY_ECDSA_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *   TURNKEY_L1_BTC_ADDRESS, TURNKEY_L1_BTC_PUBLIC_KEY_HEX
 *
 * Optional:
 *   TURNKEY_WALLET_ID - skips wallet discovery if provided
 *   STATIC_DEPOSIT_INDEX - default 0, and currently must stay 0
 *   STATIC_DEPOSIT_TXID - skips funding spend and claims an existing tx
 *   STATIC_DEPOSIT_VOUT - required vout for STATIC_DEPOSIT_TXID
 *   STATIC_DEPOSIT_AMOUNT_SATS - default spends all available funding UTXOs minus fee
 *   STATIC_DEPOSIT_FEE_SATS - default 500
 *   STATIC_DEPOSIT_MAX_CLAIM_FEE_SATS - default 500
 *   STATIC_DEPOSIT_FUNDING_TIMEOUT_MS - default 60000
 *   STATIC_DEPOSIT_FUNDING_POLL_MS - default 5000
 *   STATIC_DEPOSIT_CONFIRMATION_TIMEOUT_MS - default 300000
 *   STATIC_DEPOSIT_CONFIRMATION_POLL_MS - default 5000
 *   TURNKEY_EXPORT_SIGNER_PUBLIC_KEY - required when BASE_URL is non-production
 *   SPARK_REGTEST_ELECTRS_URL
 */

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import { env, initSparkWallet, requireEnv } from "../init";
import { DEFAULT_SPARK_REGTEST_ELECTRS_URL } from "../spark-deposit/common";
import {
  createOrReuseStaticDepositAccount,
  depositTurnkeyL1ToStaticSpark,
} from "../spark-deposit/static";

function optionalBigIntEnv(name: string): bigint | undefined {
  const value = process.env[name];
  return value ? BigInt(value) : undefined;
}

function optionalNumberEnv(name: string): number | undefined {
  const value = process.env[name];
  return value ? Number(value) : undefined;
}

async function main() {
  const network = env("SPARK_NETWORK", "REGTEST");
  if (network !== "REGTEST") {
    throw new Error("This static deposit flow only supports SPARK_NETWORK=REGTEST");
  }

  const { wallet, signer } = await initSparkWallet();
  console.log("Authenticated to Spark SO");

  try {
    const apiBaseUrl = env("BASE_URL", "https://api.turnkey.com");
    const turnkeyClient = new TurnkeyServerSDK({
      apiBaseUrl,
      apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
      apiPublicKey: requireEnv("API_PUBLIC_KEY"),
      defaultOrganizationId: requireEnv("ORGANIZATION_ID"),
    });

    const staticDepositIndex = Number(env("STATIC_DEPOSIT_INDEX", "0"));
    if (staticDepositIndex !== 0) {
      throw new Error(
        "STATIC_DEPOSIT_INDEX must be 0 because the current Spark SDK static " +
          "deposit claim path hardcodes getStaticDepositSecretKey(0)",
      );
    }

    const staticAccount = await createOrReuseStaticDepositAccount({
      turnkeyClient,
      sparkAddress: requireEnv("TURNKEY_SPARK_ADDRESS"),
      walletId: process.env.TURNKEY_WALLET_ID,
      staticDepositIndex,
      log: console.log,
    });
    console.log("Static deposit account ready.");
    console.log(`  Turnkey account: ${staticAccount.address}`);
    console.log(`  Path:            ${staticAccount.path}`);

    const result = await depositTurnkeyL1ToStaticSpark({
      wallet,
      turnkeyClient,
      turnkeyApiBaseUrl: apiBaseUrl,
      signer,
      staticDepositAccountAddress: staticAccount.address,
      staticDepositAccountPublicKeyHex: staticAccount.publicKeyHex,
      staticDepositIndex,
      fundingAddress: requireEnv("TURNKEY_L1_BTC_ADDRESS"),
      fundingPublicKeyHex: requireEnv("TURNKEY_L1_BTC_PUBLIC_KEY_HEX"),
      existingTxid: process.env.STATIC_DEPOSIT_TXID,
      existingOutputIndex: optionalNumberEnv("STATIC_DEPOSIT_VOUT"),
      amountSats: optionalBigIntEnv("STATIC_DEPOSIT_AMOUNT_SATS"),
      feeSats: BigInt(env("STATIC_DEPOSIT_FEE_SATS", "500")),
      maxClaimFeeSats: BigInt(env("STATIC_DEPOSIT_MAX_CLAIM_FEE_SATS", "500")),
      electrsUrl: env(
        "SPARK_REGTEST_ELECTRS_URL",
        DEFAULT_SPARK_REGTEST_ELECTRS_URL,
      ),
      fundingTimeoutMs: Number(env("STATIC_DEPOSIT_FUNDING_TIMEOUT_MS", "60000")),
      fundingPollMs: Number(env("STATIC_DEPOSIT_FUNDING_POLL_MS", "5000")),
      confirmationTimeoutMs: Number(
        env("STATIC_DEPOSIT_CONFIRMATION_TIMEOUT_MS", "300000"),
      ),
      confirmationPollMs: Number(
        env("STATIC_DEPOSIT_CONFIRMATION_POLL_MS", "5000"),
      ),
      log: console.log,
    });

    console.log(
      `Static deposit confirmed in block ${result.status.block_height ?? "unknown"}`,
    );
    console.log(`Claimed ${result.quoteCreditAmountSats} sats into Spark`);
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
