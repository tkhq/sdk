import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import prompts from "prompts";
import { getTurnkeyClient, pollSwapStatus } from "./turnkey";

const SLIPPAGE_BPS = "50";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export async function main() {
  const organizationId = requireEnv("ORGANIZATION_ID");
  const signWith = requireEnv("SIGN_WITH");
  const inputToken = requireEnv("FROM_TOKEN");
  const outputToken = requireEnv("TO_TOKEN");
  const inputAmount = requireEnv("AMOUNT");
  const turnkey = getTurnkeyClient();
  const apiClient = turnkey.apiClient();

  console.log(`\nUsing wallet: ${signWith}`);
  console.log(`Swap: ${inputToken} -> ${outputToken}`);
  console.log(`Amount (base units): ${inputAmount}\n`);

  const { sponsored } = await prompts({
    type: "confirm",
    name: "sponsored",
    message: "Use Turnkey gas sponsorship?",
    initial: true,
  });

  console.log("Fetching swap quotes via CREATE_SWAP_QUOTE...");
  const quoteResponse = await apiClient.createSwapQuote({
    organizationId,
    signWith,
    inputToken,
    outputToken,
    inputAmount,
    slippageBps: SLIPPAGE_BPS,
  });

  if (!quoteResponse.quotes?.length) {
    throw new Error("No swap quotes returned");
  }

  for (const quote of quoteResponse.quotes) {
    console.log(
      `  provider=${quote.provider} quoteId=${quote.quoteId}` +
        ` outputAmount=${quote.outputAmount}` +
        (quote.minOutputAmount ? ` minOutput=${quote.minOutputAmount}` : ""),
    );
  }

  const selectedQuote = quoteResponse.quotes[0]!;
  if (!selectedQuote.minOutputAmount) {
    throw new Error(
      "Selected quote missing minOutputAmount; cannot execute with price protection",
    );
  }
  console.log(
    `\nExecuting quote ${selectedQuote.quoteId} via EXECUTE_SWAP_V2...\n`,
  );

  const executeResponse = await apiClient.executeSwap({
    organizationId,
    quoteId: selectedQuote.quoteId,
    inputToken,
    inputAmount,
    outputToken,
    quotedOutputAmount: selectedQuote.outputAmount,
    minOutputAmount: selectedQuote.minOutputAmount,
    sponsor: sponsored,
  });

  const swapRequestId = executeResponse.swapRequestId;
  if (!swapRequestId) {
    throw new Error("execute_swap did not return swapRequestId");
  }

  console.log(`execute_swap submitted`);
  console.log(`  swapRequestId=${swapRequestId}`);
  if (executeResponse.provider) {
    console.log(`  provider=${executeResponse.provider}`);
  }
  if (executeResponse.quoteId) {
    console.log(`  quoteId=${executeResponse.quoteId}`);
  }
  console.log("");

  const swapStatus = await pollSwapStatus({
    apiClient,
    organizationId,
    swapRequestId,
  });

  if (swapStatus.status === "COMPLETED") {
    console.log("\nSwap completed");
    console.log(`  kind=${swapStatus.swapKind}`);
    if (swapStatus.provider) {
      console.log(`  provider=${swapStatus.provider}`);
    }
    console.log(`  inputToken=${swapStatus.inputToken}`);
    console.log(`  outputToken=${swapStatus.outputToken}`);
    console.log(`  inputAmount=${swapStatus.inputAmount}`);
    console.log(
      `  outputAmount=${swapStatus.outputAmount ?? "(not yet available)"}`,
    );
    if (swapStatus.originTxHash) {
      console.log(
        `  originTx: https://solscan.io/tx/${swapStatus.originTxHash}`,
      );
    }
    if (swapStatus.destinationTxHashes?.length) {
      for (const txHash of swapStatus.destinationTxHashes) {
        console.log(`  destinationTx: https://solscan.io/tx/${txHash}`);
      }
    }
    console.log(`  updatedAt=${swapStatus.updatedAt}`);
    console.log(`  raw=${JSON.stringify(swapStatus)}`);
    return;
  }

  console.error("\nSwap failed");
  console.error(`  status=${swapStatus.status}`);
  console.error(`  kind=${swapStatus.swapKind}`);
  if (swapStatus.provider) {
    console.error(`  provider=${swapStatus.provider}`);
  }
  if (swapStatus.refund) {
    console.error(
      `  refund=${swapStatus.refund.amount} ${swapStatus.refund.asset}` +
        (swapStatus.refund.txHash ? ` tx=${swapStatus.refund.txHash}` : ""),
    );
  }
  if (swapStatus.originTxHash) {
    console.error(
      `  originTx: https://solscan.io/tx/${swapStatus.originTxHash}`,
    );
  }
  if (swapStatus.error) {
    console.error(
      `  error=${swapStatus.error.reason}: ${swapStatus.error.message}`,
    );
  }
  console.error(`  raw=${JSON.stringify(swapStatus)}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
