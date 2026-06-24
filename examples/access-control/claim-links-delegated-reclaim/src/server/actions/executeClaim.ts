"use server";

import { encodeFunctionData, erc20Abi } from "viem";
import { getSubOrgClient } from "@/server/turnkey/clients";
import { getClaim, markClaimed } from "@/server/store";
import { evmSponsoredTx, USDC_CONTRACT } from "@/server/evm";

export async function executeClaim(input: {
  claimId: string;
  claimKeyPrivateKey: string;
  recipientAddress: string;
}): Promise<{ txHash: string }> {
  const claim = await getClaim(input.claimId);
  if (!claim) throw new Error("Claim not found");
  if (claim.state === "claimed") throw new Error("Already claimed");
  if (claim.state === "reclaimed") throw new Error("Already reclaimed");
  if (claim.state === "creating") throw new Error("Claim not yet funded");

  const claimClient = getSubOrgClient({
    subOrgId: claim.subOrgId,
    apiPublicKey: claim.claimKeyPublicKey,
    apiPrivateKey: input.claimKeyPrivateKey,
  }).apiClient();

  const { txHash } = await evmSponsoredTx({
    apiClient: claimClient,
    organizationId: claim.subOrgId,
    from: claim.escrowAddress,
    to: USDC_CONTRACT,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [input.recipientAddress as `0x${string}`, BigInt(claim.amountRaw)],
    }),
    value: "0x0",
  });

  await markClaimed({
    id: claim.id,
    claimTxHash: txHash,
    claimedToAddress: input.recipientAddress,
  });
  return { txHash };
}
