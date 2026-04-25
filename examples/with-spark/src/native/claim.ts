/**
 * Claim pending Spark transfers using the Spark SDK's native signer.
 *
 * This is the baseline path for faucet drops: no Turnkey client, no Turnkey
 * activities, and no custom claim package construction.
 */

import { initNativeSparkWallet } from "./init";
import {
  debugNativeClaim,
  installNativeFrostDebug,
  summarizeNativeTransfer,
} from "./debug";

type NativeTransfer = {
  id: string;
  leaves: unknown[];
  [key: string]: unknown;
};

type NativeTransferService = {
  queryPendingTransfers(ids?: string[]): Promise<{ transfers: NativeTransfer[] }>;
};

async function main() {
  const transferId = process.env.TRANSFER_ID;
  const { wallet, network } = await initNativeSparkWallet();
  installNativeFrostDebug(wallet);

  try {
    const sparkAddress = await wallet.getSparkAddress();
    console.log(`Native Spark baseline (${network})`);
    console.log(`Spark address: ${sparkAddress}`);

    const transferService = (wallet as unknown as {
      transferService: NativeTransferService;
    }).transferService;
    const walletClaim = wallet as unknown as {
      claimTransfer(params: {
        transfer: NativeTransfer;
        emit?: boolean;
      }): Promise<unknown[]>;
    };

    const ids = transferId ? [transferId] : undefined;
    const { transfers } = await transferService.queryPendingTransfers(ids);

    if (transfers.length === 0) {
      console.log(`No pending transfers to claim.`);
      return;
    }

    console.log(`Found ${transfers.length} pending transfer(s)`);

    for (const transfer of transfers) {
      console.log(
        `\nClaiming transfer ${transfer.id} (${transfer.leaves.length} leaves)...`,
      );
      debugNativeClaim("transfer inputs", summarizeNativeTransfer(transfer));
      const claimedLeaves = await walletClaim.claimTransfer({ transfer });
      console.log(`  Claimed ${claimedLeaves.length} leaves`);
    }

    const balance = await wallet.getBalance();
    console.log(`\nBalance: ${balance.satsBalance?.available ?? 0} sats available`);
  } finally {
    wallet.cleanupConnections();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
