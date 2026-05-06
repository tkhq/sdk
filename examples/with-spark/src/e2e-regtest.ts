/**
 * Hosted Spark REGTEST E2E:
 *
 * Lightspark faucet -> Turnkey BTC regtest address -> Spark sender wallet
 * -> Spark receiver wallet -> Turnkey BTC regtest withdrawal address.
 *
 * Run `pnpm run setup:e2e`, then run `pnpm run e2e:regtest`.
 * The E2E script prints SENDER_TURNKEY_L1_BTC_ADDRESS and waits while you
 * fund it from the Lightspark regtest faucet.
 */

import { Turnkey as TurnkeyServerSDK } from "@turnkey/sdk-server";
import type { SparkWallet } from "@buildonspark/spark-sdk";
import { env, initSparkWalletFromEnv, requireEnv } from "./init";
import type { TurnkeySparkSigner } from "./turnkeySigner";
import { turnkeyTransfer } from "./turnkeyTransfer";
import { turnkeyClaim } from "./turnkeyClaim";
import { turnkeyWithdraw } from "./turnkeyWithdraw";
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
    queryTransfer(transferId: string): Promise<PendingTransfer | undefined>;
  };
};

const TRANSFER_STATUS_COMPLETED = 5;

function optionalBigIntEnv(name: string): bigint | undefined {
  const value = process.env[name];
  return value ? BigInt(value) : undefined;
}

function optionalNumberEnv(name: string): number | undefined {
  const value = process.env[name];
  return value ? Number(value) : undefined;
}

async function getBalanceSats(wallet: SparkWallet): Promise<number> {
  const balance = await wallet.getBalance();
  const available = balance.satsBalance?.available ?? 0;
  return typeof available === "bigint" ? Number(available) : Number(available);
}

async function waitForPendingTransfer(
  wallet: SparkWallet,
  transferId: string,
  expectedBalanceSats: number,
): Promise<PendingTransfer> {
  const timeoutMs = Number(env("TRANSFER_CLAIM_TIMEOUT_MS", "120000"));
  const pollMs = Number(env("TRANSFER_CLAIM_POLL_MS", "3000"));
  const deadline = Date.now() + timeoutMs;
  const internals = wallet as unknown as WalletWithPendingTransfers;

  while (true) {
    const { transfers } = await internals.transferService.queryPendingTransfers(
      [transferId],
    );
    const transfer = transfers.find((candidate) => candidate.id === transferId);
    if (transfer) return transfer;

    const completedTransfer =
      await internals.transferService.queryTransfer(transferId);
    const balanceSats = await getBalanceSats(wallet);
    if (
      completedTransfer?.status === TRANSFER_STATUS_COMPLETED &&
      balanceSats >= expectedBalanceSats
    ) {
      console.log(
        `Transfer ${transferId} already completed; receiver balance is ${balanceSats} sats`,
      );
      return completedTransfer;
    }

    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for receiver pending transfer ${transferId}`,
      );
    }

    console.log(`Waiting for receiver pending transfer ${transferId}...`);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

function isRetryableClaimError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("ABORTED") ||
    message.includes("could not obtain lock") ||
    message.includes("SQLSTATE 55P03")
  );
}

async function claimTransferOnReceiver(params: {
  wallet: SparkWallet;
  signer: TurnkeySparkSigner;
  transferId: string;
  expectedBalanceSats: number;
}) {
  const timeoutMs = Number(env("TRANSFER_CLAIM_TIMEOUT_MS", "120000"));
  const pollMs = Number(env("TRANSFER_CLAIM_POLL_MS", "3000"));
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const transfer = await waitForPendingTransfer(
      params.wallet,
      params.transferId,
      params.expectedBalanceSats,
    );
    if (transfer.status === TRANSFER_STATUS_COMPLETED) {
      return;
    }
    console.log(
      `Claiming transfer ${transfer.id} (${transfer.leaves.length} leaves)...`,
    );

    try {
      const claimedLeaves = await turnkeyClaim(
        params.wallet,
        params.signer,
        transfer as any,
      );
      console.log(`Claimed ${claimedLeaves.length} leaves on receiver`);
      return;
    } catch (err) {
      if (!isRetryableClaimError(err) || Date.now() >= deadline) {
        throw err;
      }

      console.log(`Claim not ready yet; retrying transfer ${transfer.id}...`);
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
  }
}

async function main() {
  const network = env("SPARK_NETWORK", "REGTEST");
  if (network !== "REGTEST") {
    throw new Error("e2e:regtest requires SPARK_NETWORK=REGTEST");
  }

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
    console.log(
      "\nStep 1: Deposit Turnkey BTC regtest funds into sender Spark wallet",
    );
    console.log(
      `Sender BTC regtest address: ${requireEnv("SENDER_TURNKEY_L1_BTC_ADDRESS")}`,
    );
    const depositResult = await depositTurnkeyL1ToSpark({
      wallet: sender.wallet,
      turnkeyClient,
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
      confirmationPollMs: Number(
        env("L1_DEPOSIT_CONFIRMATION_POLL_MS", "5000"),
      ),
      log: console.log,
    });
    console.log(`Deposit tx confirmed: ${depositResult.txid}`);
    console.log(`Sender balance: ${depositResult.balanceSats} sats available`);

    console.log("\nStep 2: Transfer Spark sats from sender to receiver");
    const senderBalance = await getBalanceSats(sender.wallet);
    const configuredTransferSats = optionalNumberEnv("TRANSFER_AMOUNT_SATS");
    const transferSats = configuredTransferSats ?? senderBalance;
    if (transferSats <= 0)
      throw new Error("No sender balance available to transfer");
    if (transferSats > senderBalance) {
      throw new Error(
        `TRANSFER_AMOUNT_SATS=${transferSats} exceeds sender balance ${senderBalance}`,
      );
    }

    const transfer = await turnkeyTransfer(sender.wallet, sender.signer, {
      amountSats: transferSats,
      receiverSparkAddress: requireEnv("RECEIVER_TURNKEY_SPARK_ADDRESS"),
    });
    console.log(`Transfer initiated: ${transfer.id}`);

    console.log("\nStep 3: Claim transfer on receiver");
    const receiverBalanceBeforeClaim = await getBalanceSats(receiver.wallet);
    await claimTransferOnReceiver({
      wallet: receiver.wallet,
      signer: receiver.signer,
      transferId: transfer.id,
      expectedBalanceSats: receiverBalanceBeforeClaim + transferSats,
    });
    const receiverBalance = await getBalanceSats(receiver.wallet);
    console.log(`Receiver balance: ${receiverBalance} sats available`);

    console.log(
      "\nStep 4: Withdraw receiver Spark sats back to Bitcoin regtest",
    );
    const withdrawAddress =
      process.env.WITHDRAW_BTC_ADDRESS ||
      requireEnv("RECEIVER_TURNKEY_L1_BTC_ADDRESS");
    const exitSpeed = env("WITHDRAW_EXIT_SPEED", "FAST") as
      | "FAST"
      | "MEDIUM"
      | "SLOW";

    // Probe the SSP fee schedule with the full receiver balance, then either
    // honor WITHDRAW_AMOUNT_SATS or auto-pick a viable target. The SSP fee
    // floor is the bottom of the viable range; the per-leaf cap (regtest SSP
    // refuses leaves above some threshold) is the top. WITHDRAW_AMOUNT_SATS
    // smaller than the fee → SparkCoopExitAmountTooLowException.
    console.log("Probing withdrawal fee quote...");
    const probeQuote = await receiver.wallet.getWithdrawalFeeQuote({
      amountSats: receiverBalance,
      withdrawalAddress: withdrawAddress,
    });
    if (!probeQuote) throw new Error("Failed to get withdrawal fee quote");

    const totalFee = (() => {
      switch (exitSpeed) {
        case "SLOW":
          return (
            (probeQuote.l1BroadcastFeeSlow?.originalValue ?? 0) +
            (probeQuote.userFeeSlow?.originalValue ?? 0)
          );
        case "MEDIUM":
          return (
            (probeQuote.l1BroadcastFeeMedium?.originalValue ?? 0) +
            (probeQuote.userFeeMedium?.originalValue ?? 0)
          );
        case "FAST":
          return (
            (probeQuote.l1BroadcastFeeFast?.originalValue ?? 0) +
            (probeQuote.userFeeFast?.originalValue ?? 0)
          );
      }
    })();

    const configuredWithdrawSats = optionalNumberEnv("WITHDRAW_AMOUNT_SATS");
    // Auto-tune: 2× fee + 500 sat margin, capped at receiver balance.
    const autoWithdrawSats = Math.min(receiverBalance, totalFee * 2 + 500);
    const withdrawSats = configuredWithdrawSats ?? autoWithdrawSats;

    if (withdrawSats <= 0)
      throw new Error("No receiver balance available to withdraw");
    if (withdrawSats > receiverBalance) {
      throw new Error(
        `WITHDRAW_AMOUNT_SATS=${withdrawSats} exceeds receiver balance ${receiverBalance}`,
      );
    }
    if (withdrawSats <= totalFee) {
      throw new Error(
        `WITHDRAW_AMOUNT_SATS=${withdrawSats} ≤ ${exitSpeed} SSP fee ${totalFee}. ` +
          `Use ≥ ${totalFee + 1} sats or switch to a slower exit speed.`,
      );
    }
    console.log(
      `Withdrawing ${withdrawSats} sats (${exitSpeed} fee: ${totalFee} sats)...`,
    );

    // Re-quote at the chosen amount so connector-tx sizing matches.
    const feeQuote = await receiver.wallet.getWithdrawalFeeQuote({
      amountSats: withdrawSats,
      withdrawalAddress: withdrawAddress,
    });
    if (!feeQuote) throw new Error("Failed to get withdrawal fee quote");

    await turnkeyWithdraw(receiver.wallet, receiver.signer, {
      onchainAddress: withdrawAddress,
      amountSats: withdrawSats,
      exitSpeed,
      feeQuote,
    });
    const receiverBalanceAfterWithdraw = await getBalanceSats(receiver.wallet);
    console.log(`Withdrawal initiated to ${withdrawAddress}`);
    console.log(
      `Receiver balance: ${receiverBalanceAfterWithdraw} sats available`,
    );

    console.log("\nE2E complete.");
  } finally {
    sender.wallet.cleanupConnections();
    receiver.wallet.cleanupConnections();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
