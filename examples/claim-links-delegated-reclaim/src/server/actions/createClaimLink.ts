"use server";

import { generateP256KeyPair } from "@turnkey/crypto";
import { bootstrapClaimSubOrg } from "@/server/turnkey/bootstrap";
import { createClaim } from "@/server/store";
import { env } from "@/env";

export interface CreateClaimLinkInput {
  asset: string;
  amountRaw: string;
  amountDisplay: string;
  expirationSeconds: number;
}

export interface CreateClaimLinkResult {
  claimId: string;
  url: string;
}

export async function createClaimLink(
  input: CreateClaimLinkInput,
): Promise<CreateClaimLinkResult> {
  if (
    input.expirationSeconds <= 0 ||
    input.expirationSeconds > 60 * 60 * 24 * 30
  ) {
    throw new Error("expirationSeconds must be in (0, 30 days].");
  }

  const { publicKey: claimKeyPublicKey, privateKey: claimKeyPrivateKey } =
    generateP256KeyPair();

  const sub = await bootstrapClaimSubOrg({
    senderReclaimAddress: env.SIGN_WITH,
    claimKeyPublicKey,
    expirationSeconds: input.expirationSeconds,
  });

  const claim = await createClaim({
    chain: "evm",
    asset: input.asset,
    amountRaw: input.amountRaw,
    amountDisplay: input.amountDisplay,
    subOrgId: sub.subOrgId,
    escrowAddress: sub.escrowAddress,
    walletId: sub.walletId,
    senderAddress: env.SIGN_WITH,
    claimKeyPublicKey,
    sweepKeyPublicKey: sub.sweepKey.publicKey,
    sweepKeyPrivateKeyEnc: sub.sweepKey.privateKeyEnc,
    expirationSeconds: input.expirationSeconds,
  });

  const base = (
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const url = `${base}/claim/${claim.id}#key=${claimKeyPrivateKey}`;

  return { claimId: claim.id, url };
}
