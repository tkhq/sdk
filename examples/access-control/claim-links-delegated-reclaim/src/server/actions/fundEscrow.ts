"use server";

import { encodeFunctionData, erc20Abi } from "viem";
import { getClaim, markFunded } from "@/server/store";
import { evmSponsoredTx, USDC_CONTRACT } from "@/server/evm";
import { getParentClient } from "@/server/turnkey/clients";
import { env } from "@/env";
import { runDelegatedReclaim } from "./runDelegatedReclaim";

export async function fundEscrow(claimId: string): Promise<{ txHash: string }> {
  const claim = await getClaim(claimId);
  if (!claim) throw new Error("Claim not found");
  if (claim.state !== "creating")
    throw new Error(`Claim already in state "${claim.state}"`);

  const { txHash } = await evmSponsoredTx({
    apiClient: getParentClient().apiClient(),
    organizationId: env.NEXT_PUBLIC_TURNKEY_ORG_ID,
    from: env.SIGN_WITH,
    to: USDC_CONTRACT,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [claim.escrowAddress as `0x${string}`, BigInt(claim.amountRaw)],
    }),
    value: "0x0",
  });

  await markFunded(claimId, txHash);

  // Trigger automated reclaim after TTL. In production, replace with a scheduled cron job.
  setTimeout(async () => {
    const report = await runDelegatedReclaim();
    if (report.reclaimed.length > 0)
      console.log(
        "[auto-reclaim] swept:",
        report.reclaimed.map((r) => r.txHash),
      );
    if (report.failed.length > 0)
      console.error("[auto-reclaim] failed:", report.failed);
  }, claim.expirationSeconds * 1000);

  return { txHash };
}
