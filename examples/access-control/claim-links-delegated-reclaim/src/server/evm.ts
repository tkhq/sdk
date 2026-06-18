import "server-only";
import type { TurnkeyApiClient } from "@turnkey/sdk-server";

export const CAIP2_EVM = (process.env.NEXT_PUBLIC_EVM_CHAIN ??
  "eip155:84532") as "eip155:84532";

export const USDC_CONTRACT = (process.env.NEXT_PUBLIC_USDC_CONTRACT ??
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`;

export async function evmSponsoredTx(args: {
  apiClient: TurnkeyApiClient;
  organizationId: string;
  from: string;
  to: string;
  data: string;
  value: string;
}): Promise<{ txHash: string }> {
  const { gasStationNonce } = await args.apiClient.getNonces({
    organizationId: args.organizationId,
    address: args.from,
    caip2: CAIP2_EVM,
    gasStationNonce: true,
  });
  if (!gasStationNonce) throw new Error("Failed to fetch gasStationNonce");

  const { sendTransactionStatusId } = await args.apiClient.ethSendTransaction({
    organizationId: args.organizationId,
    from: args.from,
    to: args.to,
    caip2: CAIP2_EVM,
    sponsor: true,
    data: args.data,
    value: args.value,
    gasStationNonce,
  });

  const result = await args.apiClient.pollTransactionStatus({
    organizationId: args.organizationId,
    sendTransactionStatusId,
    pollingIntervalMs: 500,
    timeoutMs: 60_000,
  });

  if (result.txStatus !== "INCLUDED") {
    throw new Error(`EVM sponsored tx failed (status: ${result.txStatus})`);
  }
  const txHash = result.eth?.txHash;
  if (!txHash) throw new Error("EVM sponsored tx included but missing txHash");
  return { txHash };
}
