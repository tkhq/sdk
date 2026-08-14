import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import type {
  TListSolTransactionHistoryBody,
  v1SolTransactionHistoryItem,
} from "@turnkey/sdk-types";
import prompts from "prompts";
import { paginateTransactionHistory } from "./pagination";
import { getTurnkeyClient } from "./turnkey";

function formatTransfer(
  transaction: v1SolTransactionHistoryItem,
): string {
  const transfer = transaction.transfers[0];
  if (!transfer) {
    return "-";
  }

  const symbol = transfer.asset?.symbol ?? "Unknown";
  const amount = transfer.display?.crypto ?? transfer.amount;
  return `${transfer.direction} ${amount} ${symbol}`;
}

async function main() {
  const organizationId = process.env.ORGANIZATION_ID;

  if (!organizationId) {
    throw new Error("Missing ORGANIZATION_ID");
  }

  const { address, caip2 } = await prompts([
    {
      type: "text",
      name: "address",
      message: "Wallet address:",
    },
    {
      type: "text",
      name: "caip2",
      message: "Network (CAIP-2):",
      initial: "solana:mainnet",
    },
  ]);

  if (!address || !caip2) {
    console.log("Cancelled.");
    return;
  }

  const turnkey = getTurnkeyClient();
  const request: TListSolTransactionHistoryBody = {
    organizationId,
    address,
    caip2: caip2 as TListSolTransactionHistoryBody["caip2"],
  };

  await paginateTransactionHistory({
    label: `Solana transaction history for ${address} on ${caip2}`,
    fetchPage: (paginationOptions) =>
      turnkey.apiClient().listSolTransactionHistory({
        ...request,
        ...(paginationOptions ? { paginationOptions } : {}),
      }),
    formatTransaction: (transaction) => ({
      Signature: transaction.signature,
      Time: transaction.block.timestamp,
      Status: transaction.status,
      FeePayer: transaction.feePayer,
      Transfer: formatTransfer(transaction),
    }),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
