import { Turnkey } from "@turnkey/sdk-server";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

/**
 * Creates and returns a configured Turnkey client instance.
 */
export function getTurnkeyClient(): Turnkey {
  const apiPublicKey = process.env.API_PUBLIC_KEY;
  const apiPrivateKey = process.env.API_PRIVATE_KEY;
  const organizationId = process.env.ORGANIZATION_ID;
  const baseUrl = process.env.BASE_URL ?? "https://api.turnkey.com";

  if (!apiPublicKey || !apiPrivateKey || !organizationId) {
    throw new Error(
      "Missing required environment variables: API_PUBLIC_KEY, API_PRIVATE_KEY, ORGANIZATION_ID"
    );
  }

  return new Turnkey({
    apiBaseUrl: baseUrl,
    apiPublicKey,
    apiPrivateKey,
    defaultOrganizationId: organizationId,
  });
}

/**
 * Polls a transaction status until it reaches a terminal state.
 */
export async function pollTransactionStatus({
  apiClient,
  organizationId,
  sendTransactionStatusId,
  intervalMs = 500,
  timeoutMs = 120_000,
}: {
  apiClient: ReturnType<Turnkey["apiClient"]>;
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
              txError || `Transaction ${status} (no explicit error returned)`
            )
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

/**
 * Gets environment variables with validation.
 */
export function getEnvVar(name: string, required = true): string {
  const value = process.env[name];
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}
