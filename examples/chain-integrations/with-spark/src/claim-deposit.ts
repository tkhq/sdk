/**
 * Claim L1 deposit
 *
 * Claims a deposit to a Spark wallet using a known L1 transaction ID (DEPOSIT_TX_ID).
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, TURNKEY_ECDSA_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *   DEPOSIT_TX_ID
 */

import { initSparkWallet, requireEnv } from "./init";

async function main() {
  const depositTxId = requireEnv("DEPOSIT_TX_ID");

  const { wallet } = await initSparkWallet();
  console.log(`Authenticated to Spark SO`);

  let balance = await wallet.getBalance();
  console.log(`Balance: ${balance.satsBalance?.available ?? 0} sats available`);

  await wallet.claimDeposit(depositTxId);
  console.log(`Deposit claimed`);

  balance = await wallet.getBalance();
  console.log(`Balance: ${balance.satsBalance?.available ?? 0} sats available`);

  console.log(`\nDone.`);
  await wallet.cleanup();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
