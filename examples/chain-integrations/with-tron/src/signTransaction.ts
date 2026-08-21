import { Turnkey } from "@turnkey/sdk-server";
import { TronWeb } from "tronweb";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  // Initialize Turnkey client
  const turnkeyClient = new Turnkey({
    apiBaseUrl: process.env.BASE_URL!,
    apiPrivateKey: process.env.API_PRIVATE_KEY!,
    apiPublicKey: process.env.API_PUBLIC_KEY!,
    defaultOrganizationId: process.env.ORGANIZATION_ID!,
  });

  // Initialize TronWeb without a private key
  const tronWeb = new TronWeb({
    fullHost: "https://nile.trongrid.io/", // Testnet
  });

  const turnkeyAddress = process.env.TRON_ADDRESS!; // Your Tron address in Turnkey
  const recipientAddress = "TY1jfzP3s94oSzYECC89EFn17iA8S4imVZ";
  const amount = 100; // Amount in SUN (1 TRX = 1,000,000 SUN)

  // Create an unsigned transaction
  const unsignedTx = await tronWeb.transactionBuilder.sendTrx(
    recipientAddress,
    amount,
    turnkeyAddress,
  );

  // Sign with Turnkey's SignTransaction API. This returns a fully serialized
  // signed Tron transaction.
  const signedTx = await turnkeyClient.apiClient().signTransaction({
    signWith: turnkeyAddress,
    unsignedTransaction: unsignedTx.raw_data_hex,
    type: "TRANSACTION_TYPE_TRON",
  });

  // Broadcast the signed transaction
  const result = await tronWeb.trx.sendHexTransaction(
    signedTx.signedTransaction,
  );

  if (!result.result) {
    throw new Error(`Tron broadcast failed: ${JSON.stringify(result)}`);
  }

  console.log("Transaction sent! ID:", result.txid);
  console.log("https://nile.tronscan.org/#/transaction/" + result.txid);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
