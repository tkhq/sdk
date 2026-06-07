import "server-only";
import { PrismaClient } from "@prisma/client";
import type { Claim } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { Claim };

export interface CreateClaimInput {
  chain: string;
  asset: string;
  amountRaw: string;
  amountDisplay: string;
  subOrgId: string;
  escrowAddress: string;
  walletId: string;
  senderTurnkeyUserId: string;
  senderAddress: string;
  claimKeyPublicKey: string;
  sweepKeyPublicKey: string;
  sweepKeyPrivateKeyEnc: string;
  sweepPolicyId: string;
  expirationSeconds: number;
}

export async function createClaim(input: CreateClaimInput): Promise<Claim> {
  return prisma.claim.create({ data: { ...input, state: "creating" } });
}

export async function getClaim(id: string): Promise<Claim | null> {
  return prisma.claim.findUnique({ where: { id } });
}

export async function markFunded(
  id: string,
  fundTxHash: string,
): Promise<Claim> {
  return prisma.claim.update({
    where: { id },
    data: { state: "funded", fundedAt: new Date(), fundTxHash },
  });
}

export async function markClaimed(args: {
  id: string;
  claimTxHash: string;
  claimedToAddress: string;
}): Promise<Claim> {
  return prisma.claim.update({
    where: { id: args.id },
    data: {
      state: "claimed",
      claimedAt: new Date(),
      claimTxHash: args.claimTxHash,
      claimedToAddress: args.claimedToAddress,
    },
  });
}

export async function markReclaimed(args: {
  id: string;
  reclaimTxHash: string;
  reclaimMode: string;
}): Promise<Claim> {
  return prisma.claim.update({
    where: { id: args.id },
    data: {
      state: "reclaimed",
      reclaimedAt: new Date(),
      reclaimTxHash: args.reclaimTxHash,
      reclaimMode: args.reclaimMode,
    },
  });
}

export async function listExpiredUnclaimed(now = new Date()): Promise<Claim[]> {
  const all = await prisma.claim.findMany({ where: { state: "funded" } });
  return all.filter((c) => {
    const expiresAt = c.createdAt.getTime() + c.expirationSeconds * 1000;
    return expiresAt < now.getTime();
  });
}
