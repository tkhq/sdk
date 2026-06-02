import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export function getTurnkeyClient() {
  return new TurnkeySDKServer({
    apiBaseUrl: process.env.BASE_URL! ?? "https://api.turnkey.com",
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });
}

export async function pollTransactionStatus({
  apiClient,
  organizationId,
  sendTransactionStatusId,
  intervalMs = 200,
  timeoutMs = 60_000,
}: {
  apiClient: any;
  organizationId: string;
  sendTransactionStatusId: string;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<{
  eth?: { txHash?: string };
  solana?: { signature?: string };
  txStatus: string;
}> {
  console.log(`Polling transaction status for ${sendTransactionStatusId}...`);
  return apiClient.pollTransactionStatus({
    organizationId,
    sendTransactionStatusId,
    pollingIntervalMs: intervalMs,
    timeoutMs,
  });
}
