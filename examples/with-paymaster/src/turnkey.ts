import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";

export function getTurnkeyClient() {
  return new TurnkeySDKServer({
    apiBaseUrl: process.env.BASE_URL ?? "https://api.turnkey.com",
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
}): Promise<{ eth?: { txHash?: string }; txStatus: string }> {
  const start = Date.now();
  console.log(`Polling transaction status for ${sendTransactionStatusId}...`);
  return new Promise((resolve, reject) => {
    const ref = setInterval(async () => {
      try {
        if (Date.now() - start > timeoutMs) {
          clearInterval(ref);
          reject(new Error("Polling timed out"));
          return;
        }

        const resp = await apiClient.getSendTransactionStatus({
          organizationId,
          sendTransactionStatusId,
        });

        const status = resp?.txStatus;
        const txError = resp?.txError;

        if (!status) return;

        if (txError || status === "FAILED" || status === "CANCELLED") {
          clearInterval(ref);
          reject(
            new Error(
              txError || `Transaction ${status} (no explicit error returned)`,
            ),
          );
          return;
        }

        if (status === "COMPLETED" || status === "INCLUDED") {
          clearInterval(ref);
          resolve({
            eth: resp.eth,
            txStatus: status,
          });
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, intervalMs);
  });
}
