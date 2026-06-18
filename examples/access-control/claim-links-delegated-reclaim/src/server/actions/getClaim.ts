"use server";

import { getClaim as getClaimFromLedger } from "@/server/store";

export interface PublicClaim {
  id: string;
  amountDisplay: string;
  state: string;
  reclaimTxHash: string | null;
}

export async function getClaim(id: string): Promise<PublicClaim | null> {
  const row = await getClaimFromLedger(id);
  if (!row) return null;
  return {
    id: row.id,
    amountDisplay: row.amountDisplay,
    state: row.state,
    reclaimTxHash: row.reclaimTxHash ?? null,
  };
}
