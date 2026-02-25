import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Connection, PublicKey } from "@solana/web3.js";
import fetch from "cross-fetch";
import prompts from "prompts";
import { getTurnkeyClient, pollTransactionStatus } from "./turnkey";
import { SOL_MINT, USDC_MAINNET } from "./tokens";
import { lamportsToSol, solToLamports } from "./utils";

const MAINNET_CONFIG = {
  rpc: "https://api.mainnet-beta.solana.com",
  caip2: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  usdcMint: USDC_MAINNET,
  jupiterBaseUrl: "https://api.jup.ag",
  jupiterQuotePath: "/swap/v1/quote",
  jupiterSwapPath: "/swap/v1/swap",
  explorerSuffix: "",
} as const;

async function parseJsonResponse(response: Response): Promise<any> {
  const textBody = await response.text();
  if (!textBody) return {};
  try {
    return JSON.parse(textBody);
  } catch {
    return { raw: textBody };
  }
}

async function fetchJsonWithFallback(request: {
  amountLamports: bigint;
  outputMint: string;
  signWith: string;
  jupiterApiKey: string;
  jupiterBaseUrl: string;
  jupiterQuotePath: string;
  jupiterSwapPath: string;
}) {
  const base = request.jupiterBaseUrl;
  const quoteUrl =
    `${base}${request.jupiterQuotePath}` +
    `?inputMint=${SOL_MINT}` +
    `&outputMint=${request.outputMint}` +
    `&amount=${request.amountLamports.toString()}` +
    "&slippageBps=50";

  const quoteHttpResponse = await fetch(quoteUrl, {
    headers: {
      "x-api-key": request.jupiterApiKey,
    },
  });
  const quoteResponse = await parseJsonResponse(quoteHttpResponse);
  if (!quoteHttpResponse.ok || !quoteResponse?.routePlan) {
    throw new Error(
      `Quote request failed on ${base} (status ${quoteHttpResponse.status}): ${JSON.stringify(quoteResponse)}`,
    );
  }

  const swapHttpResponse = await fetch(`${base}${request.jupiterSwapPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": request.jupiterApiKey,
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: request.signWith,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  const swapResp = await parseJsonResponse(swapHttpResponse);
  if (!swapHttpResponse.ok || !swapResp?.swapTransaction) {
    throw new Error(
      `Swap request failed on ${base} (status ${swapHttpResponse.status}): ${JSON.stringify(swapResp)}`,
    );
  }

  return swapResp;
}

async function main() {
  const organizationId = process.env.ORGANIZATION_ID!;
  const signWith = process.env.SIGN_WITH!;
  const jupiterApiKey = process.env.JUPITER_API_KEY!;
  if (!organizationId || !signWith || !jupiterApiKey) {
    throw new Error("Missing ORGANIZATION_ID, SIGN_WITH, or JUPITER_API_KEY");
  }

  const network = MAINNET_CONFIG;
  const connection = new Connection(network.rpc, "confirmed");
  const owner = new PublicKey(signWith);
  const turnkey = getTurnkeyClient();

  const balanceLamports = await connection.getBalance(owner);
  const { sponsored } = await prompts({
    type: "confirm",
    name: "sponsored",
    message: "Use Turnkey gas sponsorship?",
    initial: false,
  });
  const { amountInput } = await prompts({
    type: "text",
    name: "amountInput",
    message: "Amount of SOL to swap into USDC:",
    initial: "0.0001",
  });

  if (!amountInput) {
    console.log("Swap cancelled.");
    return;
  }

  const amountLamports = solToLamports(amountInput);
  if (amountLamports <= 0n) {
    throw new Error("Amount must be greater than zero.");
  }

  console.log(`\nSigner: ${signWith}`);
  console.log(`SOL balance: ${lamportsToSol(balanceLamports)} SOL`);
  console.log(`Swap amount: ${amountInput} SOL`);
  console.log(`Sponsored: ${sponsored ? "yes" : "no"}\n`);

  const feeBufferLamports = 5_000n;
  const minimumRequired = sponsored
    ? amountLamports
    : amountLamports + feeBufferLamports;
  if (BigInt(balanceLamports) < minimumRequired) {
    throw new Error("Insufficient SOL balance for requested swap amount.");
  }

  const swapResp = await fetchJsonWithFallback({
    amountLamports,
    outputMint: network.usdcMint,
    signWith,
    jupiterApiKey,
    jupiterBaseUrl: network.jupiterBaseUrl,
    jupiterQuotePath: network.jupiterQuotePath,
    jupiterSwapPath: network.jupiterSwapPath,
  });

  const unsignedBase64 = swapResp?.swapTransaction as string | undefined;
  if (!unsignedBase64) {
    throw new Error("Jupiter did not return a swap transaction payload.");
  }

  const unsignedTransaction = Buffer.from(unsignedBase64, "base64").toString(
    "hex",
  );
  const { sendTransactionStatusId } = await turnkey
    .apiClient()
    .solSendTransaction({
      organizationId,
      unsignedTransaction,
      signWith,
      caip2: network.caip2,
      sponsor: !!sponsored,
    });

  const status = await pollTransactionStatus({
    apiClient: turnkey.apiClient(),
    organizationId,
    sendTransactionStatusId,
  });

  console.log("Swap executed successfully.");
  console.log(
    `Tx: https://explorer.solana.com/tx/${status.eth?.txHash}${network.explorerSuffix}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
