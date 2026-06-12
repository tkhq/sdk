import "server-only";

export interface Claim {
  id: string;
  chain: string;
  asset: string;
  amountRaw: string;
  amountDisplay: string;
  subOrgId: string;
  escrowAddress: string;
  walletId: string;
  senderAddress: string;
  claimKeyPublicKey: string;
  sweepKeyPublicKey: string;
  sweepKeyPrivateKeyEnc: string;
  expirationSeconds: number;
  state: string;
  createdAt: Date;
  fundTxHash: string | null;
  fundedAt: Date | null;
  claimTxHash: string | null;
  claimedAt: Date | null;
  claimedToAddress: string | null;
  reclaimTxHash: string | null;
  reclaimedAt: Date | null;
}

const g = globalThis as unknown as { __claims?: Map<string, Claim> };
if (!g.__claims) g.__claims = new Map<string, Claim>();
const claims = g.__claims;

export type CreateClaimInput = Omit<
  Claim,
  | "id"
  | "state"
  | "createdAt"
  | "fundTxHash"
  | "fundedAt"
  | "claimTxHash"
  | "claimedAt"
  | "claimedToAddress"
  | "reclaimTxHash"
  | "reclaimedAt"
>;

export function createClaim(input: CreateClaimInput): Claim {
  const claim: Claim = {
    ...input,
    id: crypto.randomUUID(),
    state: "creating",
    createdAt: new Date(),
    fundTxHash: null,
    fundedAt: null,
    claimTxHash: null,
    claimedAt: null,
    claimedToAddress: null,
    reclaimTxHash: null,
    reclaimedAt: null,
  };
  claims.set(claim.id, claim);
  return claim;
}

export function getClaim(id: string): Claim | null {
  return claims.get(id) ?? null;
}

export function markFunded(id: string, fundTxHash: string): Claim {
  const c = claims.get(id)!;
  Object.assign(c, { state: "funded", fundedAt: new Date(), fundTxHash });
  return c;
}

export function markClaimed(args: {
  id: string;
  claimTxHash: string;
  claimedToAddress: string;
}): Claim {
  const c = claims.get(args.id)!;
  Object.assign(c, {
    state: "claimed",
    claimedAt: new Date(),
    claimTxHash: args.claimTxHash,
    claimedToAddress: args.claimedToAddress,
  });
  return c;
}

export function markReclaimed(args: {
  id: string;
  reclaimTxHash: string;
}): Claim {
  const c = claims.get(args.id)!;
  Object.assign(c, {
    state: "reclaimed",
    reclaimedAt: new Date(),
    reclaimTxHash: args.reclaimTxHash,
  });
  return c;
}

export function listExpiredUnclaimed(now = new Date()): Claim[] {
  return [...claims.values()].filter((c) => {
    if (c.state !== "funded") return false;
    const baseTime = (c.fundedAt ?? c.createdAt).getTime();
    const expiresAt = baseTime + c.expirationSeconds * 1000;
    return expiresAt < now.getTime();
  });
}
