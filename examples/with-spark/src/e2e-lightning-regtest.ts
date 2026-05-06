/**
 * Hosted Spark REGTEST Lightning E2E:
 *
 * Turnkey BTC regtest funding address -> sender Spark balance
 * -> receiver Turnkey-backed Lightning invoice -> sender Lightning payment
 * -> receiver Spark settlement.
 *
 * Run `pnpm run setup:e2e`, copy the printed SENDER_* and RECEIVER_* values into
 * .env.local, then run `pnpm run e2e:lightning-regtest`.
 */

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import type { SparkWallet } from "@buildonspark/spark-sdk";
import { env, initSparkWalletFromEnv, requireEnv } from "./init";
import type { TurnkeySparkSigner } from "./turnkeySigner";
import { turnkeyClaim } from "./turnkeyClaim";
import {
  createTurnkeyLightningInvoice,
  turnkeyPayLightningInvoice,
} from "./turnkeyLightning";
import { DEFAULT_SPARK_REGTEST_ELECTRS_URL } from "./spark-deposit/common";
import { depositTurnkeyL1ToSpark } from "./spark-deposit/normal";

type PendingTransfer = {
  id: string;
  leaves: unknown[];
  [key: string]: unknown;
};

type WalletWithPendingTransfers = {
  transferService: {
    queryPendingTransfers(ids?: string[]): Promise<{
      transfers: PendingTransfer[];
    }>;
  };
};

function optionalBigIntEnv(name: string): bigint | undefined {
  const value = process.env[name];
  return value ? BigInt(value) : undefined;
}

function optionalInt(name: string): number | undefined {
  const val = process.env[name];
  if (!val) return undefined;
  const parsed = Number.parseInt(val, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function positiveInt(name: string, fallback: string): number {
  const parsed = Number.parseInt(env(name, fallback), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

async function getBalanceSats(wallet: SparkWallet): Promise<number> {
  const balance = await wallet.getBalance();
  const available = balance.satsBalance?.available ?? 0;
  return typeof available === "bigint" ? Number(available) : Number(available);
}

async function maybeFundSender(params: {
  wallet: SparkWallet;
  turnkeyClient: TurnkeyServerSDK;
  requiredBalanceSats: number;
}): Promise<number> {
  const currentBalance = await getBalanceSats(params.wallet);
  if (currentBalance >= params.requiredBalanceSats) {
    console.log(`Sender balance: ${currentBalance} sats available`);
    return currentBalance;
  }

  console.log(
    `Sender balance ${currentBalance} sats is below required ${params.requiredBalanceSats} sats.`,
  );
  console.log(
    `Sender BTC regtest address: ${requireEnv("SENDER_TURNKEY_L1_BTC_ADDRESS")}`,
  );

  const depositResult = await depositTurnkeyL1ToSpark({
    wallet: params.wallet,
    turnkeyClient: params.turnkeyClient,
    fundingAddress: requireEnv("SENDER_TURNKEY_L1_BTC_ADDRESS"),
    fundingPublicKeyHex: requireEnv("SENDER_TURNKEY_L1_BTC_PUBLIC_KEY_HEX"),
    existingTxid: process.env.L1_DEPOSIT_TXID,
    amountSats: optionalBigIntEnv("L1_DEPOSIT_AMOUNT_SATS"),
    feeSats: BigInt(env("L1_DEPOSIT_FEE_SATS", "500")),
    electrsUrl: env(
      "SPARK_REGTEST_ELECTRS_URL",
      DEFAULT_SPARK_REGTEST_ELECTRS_URL,
    ),
    fundingTimeoutMs: Number(env("L1_FUNDING_TIMEOUT_MS", "60000")),
    fundingPollMs: Number(env("L1_FUNDING_POLL_MS", "5000")),
    confirmationTimeoutMs: Number(
      env("L1_DEPOSIT_CONFIRMATION_TIMEOUT_MS", "300000"),
    ),
    confirmationPollMs: Number(env("L1_DEPOSIT_CONFIRMATION_POLL_MS", "5000")),
    log: console.log,
  });

  const fundedBalance =
    typeof depositResult.balanceSats === "bigint"
      ? Number(depositResult.balanceSats)
      : Number(depositResult.balanceSats);
  console.log(`Deposit tx confirmed: ${depositResult.txid}`);
  console.log(`Sender balance: ${fundedBalance} sats available`);

  if (fundedBalance < params.requiredBalanceSats) {
    throw new Error(
      `Sender balance ${fundedBalance} sats is still below required ${params.requiredBalanceSats} sats`,
    );
  }

  return fundedBalance;
}

function isRetryableClaimError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("ABORTED") ||
    message.includes("could not obtain lock") ||
    message.includes("SQLSTATE 55P03")
  );
}

async function claimPendingTransfers(
  wallet: SparkWallet,
  signer: TurnkeySparkSigner,
): Promise<number> {
  const internals = wallet as unknown as WalletWithPendingTransfers;
  const { transfers } = await internals.transferService.queryPendingTransfers();
  let claimedLeaves = 0;

  // Demo-wallet convenience: claim every pending transfer so the balance check
  // can observe Lightning settlement even if the SDK does not expose its transfer
  // ID in the SSP response. Production code should scope this query.
  for (const transfer of transfers) {
    console.log(
      `Claiming transfer ${transfer.id} (${transfer.leaves.length} leaves)...`,
    );
    const leaves = await turnkeyClaim(wallet, signer, transfer as any);
    claimedLeaves += leaves.length;
  }

  return claimedLeaves;
}

async function waitForReceiverSettlement(params: {
  wallet: SparkWallet;
  signer: TurnkeySparkSigner;
  balanceBeforeSats: number;
  amountSats: number;
}): Promise<number> {
  const timeoutMs = Number(env("LIGHTNING_SETTLEMENT_TIMEOUT_MS", "120000"));
  const pollMs = Number(env("LIGHTNING_SETTLEMENT_POLL_MS", "3000"));
  const deadline = Date.now() + timeoutMs;
  const expectedBalance = params.balanceBeforeSats + params.amountSats;

  while (true) {
    try {
      const claimedLeaves = await claimPendingTransfers(
        params.wallet,
        params.signer,
      );
      if (claimedLeaves > 0) {
        console.log(`Claimed ${claimedLeaves} receiver leaves`);
      }
    } catch (err) {
      if (!isRetryableClaimError(err) || Date.now() >= deadline) {
        throw err;
      }
      console.log("Receiver claim not ready yet; retrying...");
    }

    const receiverBalance = await getBalanceSats(params.wallet);
    if (receiverBalance >= expectedBalance) {
      return receiverBalance;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for receiver settlement. ` +
          `Expected at least ${expectedBalance} sats, got ${receiverBalance} sats.`,
      );
    }

    console.log(
      `Waiting for receiver settlement: ${receiverBalance}/${expectedBalance} sats...`,
    );
    await sleep(pollMs);
  }
}

async function main() {
  const network = env("SPARK_NETWORK", "REGTEST");
  if (network !== "REGTEST") {
    throw new Error("e2e:lightning-regtest requires SPARK_NETWORK=REGTEST");
  }

  const lightningAmountSats = positiveInt("LIGHTNING_AMOUNT_SATS", "500");
  const maxFeeSats = positiveInt("LIGHTNING_MAX_FEE_SATS", "1000");
  const requiredSenderBalance = lightningAmountSats + maxFeeSats;

  const turnkeyClient = new TurnkeyServerSDK({
    apiBaseUrl: env("BASE_URL", "https://api.turnkey.com"),
    apiPrivateKey: requireEnv("API_PRIVATE_KEY"),
    apiPublicKey: requireEnv("API_PUBLIC_KEY"),
    defaultOrganizationId: requireEnv("ORGANIZATION_ID"),
  });

  console.log("Initializing sender Spark wallet...");
  const sender = await initSparkWalletFromEnv("SENDER_");
  console.log("Initializing receiver Spark wallet...");
  const receiver = await initSparkWalletFromEnv("RECEIVER_");

  try {
    console.log("\nStep 1: Ensure sender has enough Spark balance");
    await maybeFundSender({
      wallet: sender.wallet,
      turnkeyClient,
      requiredBalanceSats: requiredSenderBalance,
    });

    console.log("\nStep 2: Create receiver Lightning invoice");
    const invoiceParams: Parameters<typeof createTurnkeyLightningInvoice>[2] = {
      amountSats: lightningAmountSats,
      memo: process.env.LIGHTNING_MEMO ?? "Turnkey Spark Lightning E2E",
      includeSparkAddress:
        process.env.LIGHTNING_INCLUDE_SPARK_ADDRESS === "true",
      includeSparkInvoice:
        process.env.LIGHTNING_INCLUDE_SPARK_INVOICE === "true",
    };
    const expirySeconds = optionalInt("LIGHTNING_EXPIRY_SECONDS");
    if (expirySeconds !== undefined) {
      invoiceParams.expirySeconds = expirySeconds;
    }

    const invoice = await createTurnkeyLightningInvoice(
      receiver.wallet,
      receiver.signer,
      invoiceParams,
    );
    console.log(`Lightning receive request: ${invoice.id}`);
    console.log(`Invoice status: ${invoice.status}`);
    console.log(`Payment hash: ${invoice.invoice.paymentHash}`);

    console.log("\nStep 3: Pay invoice from sender wallet");
    const encodedInvoice = invoice.invoice.encodedInvoice;
    const feeEstimate = await sender.wallet.getLightningSendFeeEstimate({
      encodedInvoice,
    });
    if (feeEstimate > maxFeeSats) {
      throw new Error(
        `Lightning fee estimate ${feeEstimate} sats exceeds LIGHTNING_MAX_FEE_SATS=${maxFeeSats}`,
      );
    }
    console.log(`Lightning fee estimate: ${feeEstimate} sats`);

    const senderBalanceBeforeSend = await getBalanceSats(sender.wallet);
    const totalDebit = lightningAmountSats + feeEstimate;
    if (senderBalanceBeforeSend < totalDebit) {
      throw new Error(
        `Sender balance ${senderBalanceBeforeSend} sats is below total Lightning debit ${totalDebit} sats`,
      );
    }

    const sendParams: Parameters<typeof turnkeyPayLightningInvoice>[2] = {
      invoice: encodedInvoice,
      maxFeeSats,
    };
    if (process.env.LIGHTNING_IDEMPOTENCY_KEY) {
      sendParams.idempotencyKey = process.env.LIGHTNING_IDEMPOTENCY_KEY;
    }

    const receiverBalanceBeforeSend = await getBalanceSats(receiver.wallet);
    const sendResponse = await turnkeyPayLightningInvoice(
      sender.wallet,
      sender.signer,
      sendParams,
    );
    console.log("Lightning send response:");
    console.log(safeJson(sendResponse));

    const senderBalanceAfterSend = await getBalanceSats(sender.wallet);
    console.log(`Sender balance: ${senderBalanceAfterSend} sats available`);

    console.log("\nStep 4: Claim or verify receiver settlement");
    const receiverBalance = await waitForReceiverSettlement({
      wallet: receiver.wallet,
      signer: receiver.signer,
      balanceBeforeSats: receiverBalanceBeforeSend,
      amountSats: lightningAmountSats,
    });
    console.log(`Receiver balance: ${receiverBalance} sats available`);

    console.log("\nLightning E2E complete.");
  } finally {
    sender.wallet.cleanupConnections();
    receiver.wallet.cleanupConnections();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
