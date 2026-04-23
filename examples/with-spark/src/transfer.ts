/**
 * Transfer: Spark → Spark (send side)
 *
 * Sends sats from the Turnkey-backed wallet to another Spark address.
 * Uses SPARK_PREPARE_AND_SIGN with a transfer package request — FROST
 * signing and key tweak encryption happen atomically in the enclave.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *   RECEIVER_SPARK_ADDRESS
 *
 * Optional:
 *   TRANSFER_AMOUNT_SATS (default: 50000)
 */

import { initSparkWallet, requireEnv, env } from "./init";
import { turnkeyTransfer } from "./turnkeyTransfer";

async function main() {
  const receiverSparkAddress = requireEnv("RECEIVER_SPARK_ADDRESS");
  const transferSats = Number(env("TRANSFER_AMOUNT_SATS", "50000"));

  const { wallet, signer } = await initSparkWallet();
  console.log(`Authenticated to Spark SO`);

  const balance = await wallet.getBalance();
  console.log(`Balance: ${balance.satsBalance?.available ?? 0} sats available`);

  console.log(`Transferring ${transferSats} sats → ${receiverSparkAddress}...`);
  const result = await turnkeyTransfer(wallet, signer, {
    amountSats: transferSats,
    receiverSparkAddress,
  });
  console.log(`Transfer initiated: ${result.id}`);

  const balanceAfter = await wallet.getBalance();
  console.log(`Balance: ${balanceAfter.satsBalance?.available ?? 0} sats available`);

  console.log(`\nDone.`);
  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
