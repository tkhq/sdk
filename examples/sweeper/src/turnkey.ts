import { Turnkey as TurnkeySDKServer } from "@turnkey/sdk-server";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
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
  intervalMs = 500,
  timeoutMs = 60_000,
}: {
  apiClient: any;
  organizationId: string;
  sendTransactionStatusId: string;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<{ eth?: { txHash?: string }; txStatus: string }> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const ref = setInterval(async () => {
      try {
        // Safety: timeout
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

        // Keep polling if no status yet
        if (!status) return;

        // Failure states
        if (
          txError ||
          status === "FAILED" ||
          status === "CANCELLED" ||
          status === "DROPPED"
        ) {
          clearInterval(ref);
          reject(
            new Error(
              txError || `Transaction ${status} (no explicit error returned)`,
            ),
          );
          return;
        }

        // Success states
        if (status === "COMPLETED" || status === "INCLUDED") {
          clearInterval(ref);
          resolve({
            eth: resp.eth,
            txStatus: status,
          });
        }
      } catch (err) {
        // Non-fatal polling exception (RPC hiccups, transient server issues)
        console.warn("Polling error:", err);
      }
    }, intervalMs);
  });
}
