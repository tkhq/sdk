import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import type { TListEthTransactionHistoryBody } from "@turnkey/sdk-types";
import prompts from "prompts";
import { formatTransfer } from "./format";
import { paginateTransactionHistory } from "./pagination";
import { getTurnkeyClient } from "./turnkey";

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
      initial: "eip155:1",
    },
  ]);

  if (!address || !caip2) {
    console.log("Cancelled.");
    return;
  }

  const turnkey = getTurnkeyClient();
  const request: TListEthTransactionHistoryBody = {
    organizationId,
    address,
    caip2: caip2 as TListEthTransactionHistoryBody["caip2"],
  };

  await paginateTransactionHistory({
    label: `EVM transaction history for ${address} on ${caip2}`,
    fetchPage: (paginationOptions) =>
      turnkey.apiClient().listEthTransactionHistory({
        ...request,
        ...(paginationOptions ? { paginationOptions } : {}),
      }),
    formatTransaction: (transaction) => ({
      Hash: transaction.transactionHash,
      Time: transaction.block.timestamp,
      Status: transaction.status,
      From: transaction.from,
      To: transaction.to ?? "-",
      Transfer: transaction.transfers[0]
        ? formatTransfer(transaction.transfers[0])
        : "-",
    }),
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
