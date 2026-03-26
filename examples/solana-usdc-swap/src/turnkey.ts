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

// createTransactionStatusError preserves the structured status payload on
// polling failures so example consumers can inspect backend error details.
function createTransactionStatusError(response: any): Error {
  const error = new Error(
    response?.error?.message || `Transaction ${response?.txStatus}`,
  ) as Error & {
    cause?: unknown;
    txStatus?: string;
    statusResponse?: unknown;
    transactionError?: unknown;
  };

  error.name = "TransactionStatusError";
  error.cause = response?.error;
  error.txStatus = response?.txStatus;
  error.statusResponse = response;

  if (response?.error) {
    error.transactionError = response.error;
  }

  return error;
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
  const start = Date.now();
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
        if (!status) return;

        if (status === "FAILED" || status === "CANCELLED") {
          clearInterval(ref);
          reject(createTransactionStatusError(resp));
          return;
        }

        if (status === "COMPLETED" || status === "INCLUDED") {
          clearInterval(ref);
          resolve({
            eth: resp.eth,
            solana: resp.solana,
            txStatus: status,
          });
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, intervalMs);
  });
}
