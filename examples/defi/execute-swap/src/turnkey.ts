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

type TurnkeyApiClient = ReturnType<
  ReturnType<typeof getTurnkeyClient>["apiClient"]
>;
type SwapStatus = Awaited<ReturnType<TurnkeyApiClient["getSwapStatus"]>>;

const TERMINAL_SWAP_STATUSES = new Set(["COMPLETED", "FAILED"]);

// Poll get_swap_status until the swap reaches COMPLETED or FAILED.
export async function pollSwapStatus({
  apiClient,
  organizationId,
  swapRequestId,
  intervalMs = 1_000,
  timeoutMs = 120_000,
}: {
  apiClient: TurnkeyApiClient;
  organizationId: string;
  swapRequestId: string;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<SwapStatus> {
  console.log(`Polling swap status for ${swapRequestId}...`);

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await apiClient.getSwapStatus({
      organizationId,
      swapRequestId,
    });

    console.log(
      `  status=${status.status} kind=${status.swapKind}` +
        (status.provider ? ` provider=${status.provider}` : "") +
        (status.originTxHash ? ` originTx=${status.originTxHash}` : "") +
        (status.destinationTxHashes?.length
          ? ` destinationTxs=${status.destinationTxHashes.join(",")}`
          : "") +
        (status.error ? ` error=${status.error.message}` : ""),
    );

    if (TERMINAL_SWAP_STATUSES.has(status.status)) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Swap status polling timed out after ${timeoutMs}ms`);
}
