"use server";

import { encodeFunctionData, erc20Abi } from "viem";
import { getSubOrgClient } from "@/server/turnkey/clients";
import { decryptAtRest } from "@/server/crypto";
import { listExpiredUnclaimed, markReclaimed } from "@/server/store";
import { evmSponsoredTx, USDC_CONTRACT } from "@/server/evm";

export interface DelegatedReclaimReport {
  considered: number;
  reclaimed: Array<{ claimId: string; txHash: string }>;
  failed: Array<{ claimId: string; error: string }>;
}

// Sweeps all funded-but-expired claims back to the sender via the sweep key.
// Idempotent - re-running only picks up still-unclaimed rows.
export async function runDelegatedReclaim(): Promise<DelegatedReclaimReport> {
  const candidates = await listExpiredUnclaimed();
  const report: DelegatedReclaimReport = {
    considered: candidates.length,
    reclaimed: [],
    failed: [],
  };

  for (const claim of candidates) {
    try {
      const sweepClient = getSubOrgClient({
        subOrgId: claim.subOrgId,
        apiPublicKey: claim.sweepKeyPublicKey,
        apiPrivateKey: decryptAtRest(claim.sweepKeyPrivateKeyEnc),
      }).apiClient();

      const { txHash } = await evmSponsoredTx({
        apiClient: sweepClient,
        organizationId: claim.subOrgId,
        from: claim.escrowAddress,
        to: USDC_CONTRACT,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [claim.senderAddress as `0x${string}`, BigInt(claim.amountRaw)],
        }),
        value: "0x0",
      });

      await markReclaimed({ id: claim.id, reclaimTxHash: txHash });
      report.reclaimed.push({ claimId: claim.id, txHash });
    } catch (err) {
      report.failed.push({
        claimId: claim.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return report;
}
