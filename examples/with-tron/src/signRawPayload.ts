import { Turnkey } from "@turnkey/sdk-server";
import { TronWeb } from "tronweb";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from `.env.local`
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  // Initialize Turnkey client
  const turnkeyClient = new Turnkey({
    apiBaseUrl: "https://api.turnkey.com",
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

  // 1. Create an unsigned transaction
  const unsignedTx = await tronWeb.transactionBuilder.sendTrx(
    recipientAddress,
    amount,
    turnkeyAddress,
  );

  // Sign with Turnkey
  const { r, s, v } = await turnkeyClient.apiClient().signRawPayload({
    organizationId: process.env.ORGANIZATION_ID!,
    signWith: turnkeyAddress,
    payload: unsignedTx.raw_data_hex,
    encoding: "PAYLOAD_ENCODING_HEXADECIMAL",
    hashFunction: "HASH_FUNCTION_SHA256",
  });

  type SignedTransaction = typeof unsignedTx & { signature: string[] };

  // Add the signature to the transaction
  const signedTx: SignedTransaction = {
    ...unsignedTx,
    signature: [r + s + v],
  };

  // 3. Broadcast the signed transaction
  const result = await tronWeb.trx.sendRawTransaction(signedTx);

  console.log("Transaction sent! ID:", result.txid);
  console.log("https://nile.tronscan.org/#/transaction/" + result.txid);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
