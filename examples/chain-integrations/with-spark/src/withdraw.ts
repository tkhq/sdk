/**
 * Withdraw: Spark → Bitcoin L1 (cooperative exit)
 *
 * Sends Spark leaves to the SSP which broadcasts an L1 transaction.
 * Uses SPARK_PREPARE_TRANSFER (with the SSP as receiver) for key tweak
 * encryption, after refund FROST signing via SPARK_SIGN_FROST.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, TURNKEY_ECDSA_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *   WITHDRAW_BTC_ADDRESS
 *
 * Optional:
 *   WITHDRAW_AMOUNT_SATS (default: 25000)
 *   WITHDRAW_EXIT_SPEED  (default: FAST) — FAST, MEDIUM, or SLOW
 */

import { initSparkWallet, requireEnv, env } from "./init";
import type { ExitSpeed } from "@buildonspark/spark-sdk/dist/types";

async function main() {
  const withdrawBtcAddress = requireEnv("WITHDRAW_BTC_ADDRESS");
  const withdrawSats = Number(env("WITHDRAW_AMOUNT_SATS", "25000"));
  const exitSpeed = env("WITHDRAW_EXIT_SPEED", "FAST") as ExitSpeed;

  const { wallet } = await initSparkWallet();
  console.log(`Authenticated to Spark SO`);

  const balance = await wallet.getBalance();
  console.log(`Balance: ${balance.satsBalance?.available ?? 0} sats available`);

  console.log(`Getting fee quote...`);
  const feeQuote = await wallet.getWithdrawalFeeQuote({
    amountSats: withdrawSats,
    withdrawalAddress: withdrawBtcAddress,
  });
  if (!feeQuote) throw new Error("Failed to get withdrawal fee quote");
  console.log(`Fee quote: ${JSON.stringify(feeQuote)}`);

  console.log(`Withdrawing ${withdrawSats} sats → ${withdrawBtcAddress}...`);
  await wallet.withdraw({
    onchainAddress: withdrawBtcAddress,
    amountSats: withdrawSats,
    exitSpeed,
    feeQuote,
  });
  console.log(`Withdrawal initiated`);

  const balanceAfter = await wallet.getBalance();
  console.log(
    `Balance: ${balanceAfter.satsBalance?.available ?? 0} sats available`,
  );

  console.log(`\nDone.`);
  await wallet.cleanup();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
