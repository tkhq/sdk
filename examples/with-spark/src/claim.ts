/**
 * Claim: receive an inbound Spark → Spark transfer
 *
 * Queries pending transfers addressed to this wallet, then claims them.
 * The enclave atomically verifies the sender's per-leaf signature,
 * ECIES-decrypts the transfer secret, and builds encrypted operator
 * packages via SPARK_PREPARE_AND_SIGN with a claim package request.
 *
 * Required env vars:
 *   API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID
 *   TURNKEY_SPARK_ADDRESS, IDENTITY_PUBLIC_KEY_HEX
 *
 * Optional:
 *   TRANSFER_ID — claim a specific transfer (default: claim all pending)
 */

import { initSparkWallet } from "./init";
import { turnkeyClaim } from "./turnkeyClaim";

async function main() {
  const transferId = process.env.TRANSFER_ID;

  const { wallet, signer } = await initSparkWallet();
  console.log(`Authenticated to Spark SO`);

  const internals = wallet as unknown as {
    transferService: {
      queryPendingTransfers(ids?: string[]): Promise<{
        transfers: Array<{ id: string; leaves: unknown[]; [k: string]: unknown }>;
      }>;
    };
  };

  const ids = transferId ? [transferId] : undefined;
  const { transfers } = await internals.transferService.queryPendingTransfers(ids);

  if (transfers.length === 0) {
    console.log(`No pending transfers to claim.`);
    wallet.cleanupConnections();
    return;
  }

  console.log(`Found ${transfers.length} pending transfer(s)`);

  for (const transfer of transfers) {
    console.log(`\nClaiming transfer ${transfer.id} (${transfer.leaves.length} leaves)...`);
    const claimedLeaves = await turnkeyClaim(wallet, signer, transfer as any);
    console.log(`  Claimed ${claimedLeaves.length} leaves`);
  }

  const balance = await wallet.getBalance();
  console.log(`\nBalance: ${balance.satsBalance?.available ?? 0} sats available`);

  console.log(`\nDone.`);
  wallet.cleanupConnections();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
