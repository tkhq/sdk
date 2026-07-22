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
  const walletAccount = requireEnv("SIGN_WITH");
  const inputToken = requireEnv("FROM_TOKEN");
  const outputToken = requireEnv("TO_TOKEN");
  const inputAmount = requireEnv("AMOUNT");
  const turnkey = getTurnkeyClient();
  const apiClient = turnkey.apiClient();

  console.log(`\nUsing wallet: ${walletAccount}`);
  console.log(`Swap: ${inputToken} -> ${outputToken}`);
  console.log(`Amount (base units): ${inputAmount}\n`);

  const { sponsored } = await prompts({
    type: "confirm",
    name: "sponsored",
    message: "Use Turnkey gas sponsorship?",
    initial: true,
  });

  console.log("Fetching swap quotes...");
  const quoteResponse = await apiClient.getSwapQuote({
    organizationId,
    inputToken,
    outputToken,
    inputAmount,
    walletAccount,
    slippage: SLIPPAGE_BPS,
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
  console.log(`\nExecuting with provider=${selectedQuote.provider}...\n`);

  const executeResponse = await apiClient.executeSwap({
    organizationId,
    inputToken,
    outputToken,
    inputAmount,
    walletAccount,
    slippage: SLIPPAGE_BPS,
    provider: selectedQuote.provider,
    sponsor: sponsored,
  });

  const sendTransactionStatusId = executeResponse.sendTransactionStatusId;
  if (!sendTransactionStatusId) {
    throw new Error("execute_swap did not return sendTransactionStatusId");
  }

  console.log(`execute_swap submitted`);
  console.log(`  sendTransactionStatusId=${sendTransactionStatusId}`);
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
    sendTransactionStatusId,
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
    // Actual fill amount in base units when Broadcast has recorded it.
    console.log(
      `  outputAmount=${swapStatus.outputAmount ?? "(not yet available)"}`,
    );
    if (swapStatus.originTxHash) {
      console.log(
        `  originTx: https://solscan.io/tx/${swapStatus.originTxHash}`,
      );
    }
    if (swapStatus.destinationTxHash) {
      console.log(
        `  destinationTx: https://solscan.io/tx/${swapStatus.destinationTxHash}`,
      );
    }
    if (swapStatus.providerStatus) {
      console.log(`  providerStatus=${swapStatus.providerStatus}`);
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
  if (swapStatus.settledAsset) {
    console.error(
      `  settled=${swapStatus.settledAmount ?? "?"} ${swapStatus.settledAsset}`,
    );
  }
  if (swapStatus.settlementTxHash) {
    console.error(`  settlementTxHash=${swapStatus.settlementTxHash}`);
  }
  if (swapStatus.originTxHash) {
    console.error(
      `  originTx: https://solscan.io/tx/${swapStatus.originTxHash}`,
    );
  }
  if (swapStatus.providerStatus) {
    console.error(`  providerStatus=${swapStatus.providerStatus}`);
  }
  console.error(`  raw=${JSON.stringify(swapStatus)}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
