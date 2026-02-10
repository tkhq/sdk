import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export function getTurnkeyClient() {
  const stamper = new ApiKeyStamper({
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
  });

  return new TurnkeyClient(
    { baseUrl: process.env.BASE_URL ?? "https://api.turnkey.com" },
    stamper
  );
}

export async function pollTransactionStatus({
  client,
  organizationId,
  sendTransactionStatusId,
  intervalMs = 200,
  timeoutMs = 60_000,
}: {
  client: TurnkeyClient;
  organizationId: string;
  sendTransactionStatusId: string;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<{ txStatus: string; txHash?: string }> {
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

        const resp = await client.getSendTransactionStatus({
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
          // Extract tx hash from response - check for sol or eth fields
          const txHash = (resp as any)?.sol?.txHash || (resp as any)?.eth?.txHash;
          resolve({
            txStatus: status,
            txHash,
          });
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, intervalMs);
  });
}
