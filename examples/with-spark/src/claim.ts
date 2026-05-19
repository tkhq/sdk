/**
 * Claim: receive an inbound Spark → Spark transfer
 *
 * Queries pending transfers addressed to this wallet, then claims them.
 * The enclave atomically verifies the sender's per-leaf signature,
 * ECIES-decrypts the transfer secret, and builds encrypted operator
 * packages via the SPARK_CLAIM_TRANSFER activity.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, TURNKEY_ECDSA_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *
 * Optional:
 *   TRANSFER_ID — claim a specific transfer (default: claim all pending)
 */

import { initSparkWalletFromEnv } from "./init";
import { turnkeyClaim } from "./internal/turnkeyClaim";
import { getInternals } from "./internal/turnkeyInternal";

async function main() {
  const transferId = process.env.TRANSFER_ID;

  const { wallet, signer } = await initSparkWalletFromEnv(
    process.env.CLAIM_ENV_PREFIX ?? "",
  );
  console.log(`Authenticated to Spark SO`);

  const ids = transferId ? [transferId] : undefined;
  const { transfers } =
    await getInternals(wallet).transferService.queryPendingTransfers(ids);

  if (transfers.length === 0) {
    console.log(`No pending transfers to claim.`);
    wallet.cleanupConnections();
    return;
  }

  console.log(`Found ${transfers.length} pending transfer(s)`);

  for (const transfer of transfers) {
    console.log(
      `\nClaiming transfer ${transfer.id} (${transfer.leaves?.length ?? 0} leaves)...`,
    );
    const claimedLeaves = await turnkeyClaim(wallet, signer, transfer);
    console.log(`  Claimed ${claimedLeaves.length} leaves`);
  }

  const balance = await wallet.getBalance();
  console.log(
    `\nBalance: ${balance.satsBalance?.available ?? 0} sats available`,
  );

  console.log(`\nDone.`);
  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
