import * as dotenv from "dotenv";
import * as path from "path";
import { TurnkeySigner } from "@turnkey/solana";
import { TurnkeyClient } from "@turnkey/http";
import { ApiKeyStamper } from "@turnkey/api-key-stamper";

import { Connection, VersionedTransaction } from "@solana/web3.js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

export async function quoteResponse() {

  const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL!;
  const TURNKEY_SOLANA_ADDRESS = process.env.SOLANA_ADDRESS!;

  const solConnection = new Connection(SOLANA_RPC_URL);

  const jupQuoteURI = "https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=10000000&slippageBps=50";

  const organizationId = process.env.ORGANIZATION_ID!;

  const turnkeyClient = new TurnkeyClient(
    { baseUrl: process.env.BASE_URL! },
    new ApiKeyStamper({
      apiPublicKey: process.env.API_PUBLIC_KEY!,
      apiPrivateKey: process.env.API_PRIVATE_KEY!,
    })
  );

  const turnkeySigner = new TurnkeySigner({
    organizationId: organizationId,
    client: turnkeyClient
  });

  const jupResponse = await fetch(jupQuoteURI);
  const jsonResponse = await jupResponse.json();

  const fetchURI = "https://quote-api.jup.ag/v6/swap";
  const fetchBody = JSON.stringify({
    quoteResponse: jsonResponse,
    userPublicKey: TURNKEY_SOLANA_ADDRESS,
    wrapAndUnwrapSol: true
  });

  const fetchResponse = await fetch(fetchURI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: fetchBody
  });
  const jsonFetchResponse = await fetchResponse.json();

  const swapTransactionBuf = Buffer.from(jsonFetchResponse.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  await turnkeySigner.signAllTransactions([transaction], TURNKEY_SOLANA_ADDRESS);

  const rawTransaction = transaction.serialize();

  const txId = await solConnection.sendRawTransaction(rawTransaction, {
    skipPreflight: true,
    maxRetries: 3,
  });

  console.log(`pending confirm: ${txId}`);
  await solConnection.confirmTransaction(txId);
  console.log(`https://solscan.io/tx/${txId}`);
}
